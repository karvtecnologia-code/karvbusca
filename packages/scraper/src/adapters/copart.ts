import { dataBR, dinheiro, extrairCidade, extrairUF, inteiro, type LoteColetado, type TipoVeiculo } from "@karv/core";
import { abrir, pausa, type Adapter } from "../base";

/**
 * Copart Brasil (copart.com.br) — Copart do Brasil Organização de Leilões, CNPJ 14.517.191/0001-78.
 * A busca é uma API JSON (POST /public/lots/search). Pedimos só os lotes cujo motor dá partida
 * (filtro oficial "condicaofuncionamento"): ~6 mil de ~13 mil, já focado em quem quer rodar.
 */
const BASE = "https://www.copart.com.br";
const POR_PAGINA = 100;
const MAX_PAGINAS = 90;
const FILTRO_FUNCIONA = 'condicaofuncionamento:"Motor dá partida e engrena",condicaofuncionamento:"Motor dá partida"';

const TIPOS: Record<string, TipoVeiculo> = {
  "automóveis": "carro",
  "suv pequenos": "carro",
  "suv grandes": "carro",
  "picapes pequenas": "carro",
  "picapes grandes": "carro",
  "utilitários pequenos": "carro",
  motos: "moto",
};

interface CopartLote {
  ln: number;
  lotNumberStr?: string;
  mkn?: string; // marca
  lm?: string; // modelo
  eng?: string; // versão/motor
  lcy?: string; // ano modelo
  manufactureYear?: string;
  ld?: string; // descrição curta
  yn?: string; // pátio "CANOAS - RS"
  ad?: string; // data do leilão
  hb?: number; // maior lance
  la?: string; // valor de referência
  tims?: string; // foto
  vehicleType?: string;
  damageClassification?: string; // "Pequena Monta", "Aguardando Classificação"...
  drivabilityRating?: string; // "Motor dá partida e engrena"
  lossType?: string; // COLISÃO, FINANCIAMENTO, ROUBO/FURTO, ENCHENTE...
  sellerName?: string;
  saleType?: string;
  obc?: string;
}

const SEM_SINISTRO = /financiamento|uso normal|frota|cons[oó]rcio|inteiro/i;

export function parseCopart(json: { data?: { results?: { content?: CopartLote[] } } }): LoteColetado[] {
  const out: LoteColetado[] = [];
  for (const c of json.data?.results?.content ?? []) {
    const tipo = TIPOS[(c.vehicleType ?? "").toLowerCase()];
    if (!tipo) continue; // caminhões, ônibus, implementos…
    const dano = c.damageClassification ?? "";
    // "Não Aplicável" sem sinistro (financiamento, frota…) = sem monta; "Aguardando" = não informado
    const montaTexto = /n[aã]o aplic/i.test(dano) && SEM_SINISTRO.test(c.lossType ?? "") ? "sem monta" : dano;
    const local = (c.yn ?? "").replace(/\s*-\s*/, "-");
    out.push({
      site: "copart",
      idExterno: String(c.ln),
      url: `${BASE}/lot/${c.ln}`,
      titulo: [c.mkn, c.lm, c.eng].filter(Boolean).join(" ").trim() || (c.ld ?? `Lote ${c.ln}`),
      tipo,
      marca: c.mkn,
      modelo: c.lm,
      versao: c.eng,
      anoFab: inteiro(c.manufactureYear),
      anoMod: inteiro(c.lcy),
      uf: extrairUF(local),
      cidade: extrairCidade(local),
      condicaoTexto: [montaTexto, c.drivabilityRating, c.lossType].filter(Boolean).join(" . "),
      observacoes: [c.lossType && `Sinistro/origem: ${c.lossType}`, dano && `Dano: ${dano}`, c.drivabilityRating].filter(Boolean).join(" . "),
      procedenciaTexto: [c.lossType, c.sellerName].filter(Boolean).join(" . "),
      lanceAtual: c.hb || undefined,
      avaliacao: dinheiro(c.la) || undefined,
      fimEm: dataBR(c.ad),
      status: c.saleType,
      fotos: c.tims ? [c.tims.replace("imageType=thumbnail", "imageType=full")] : [],
      raw: c,
    });
  }
  return out;
}

export const copart: Adapter = {
  slug: "copart",
  async listar({ page, log }) {
    await abrir(page, `${BASE}/search/autom%C3%B3veis/`);
    const todos: LoteColetado[] = [];
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const json = await page.evaluate(
        async ({ pagina, tam, filtro }) => {
          const body = new URLSearchParams({
            draw: String(pagina + 1),
            start: String(pagina * tam),
            length: String(tam),
            sort: "auction_date_utc asc,brazil_default_sort asc",
            defaultSort: "true",
            "filter[FUNC]": filtro,
            query: "*",
            watchListOnly: "false",
            freeFormSearch: "false",
            page: String(pagina),
            size: String(tam),
          });
          const r = await fetch("/public/lots/search", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest" },
            body,
          });
          if (!r.ok) throw new Error(`lots/search HTTP ${r.status}`);
          return r.json();
        },
        { pagina, tam: POR_PAGINA, filtro: FILTRO_FUNCIONA },
      );
      const brutos = json?.data?.results?.content?.length ?? 0;
      const total = json?.data?.results?.totalElements ?? 0;
      todos.push(...parseCopart(json));
      log(`página ${pagina + 1}: ${brutos} lotes (total ${total})`);
      if (brutos < POR_PAGINA || (pagina + 1) * POR_PAGINA >= total) break;
      await pausa();
    }
    return todos;
  },
};
