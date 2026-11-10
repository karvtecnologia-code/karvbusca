import { anos, dataBR, normalizar, type LoteColetado, type TipoVeiculo } from "@karv/core";
import { abrir, pausa, type Adapter } from "../base";

/**
 * Pestana Leilões (pestanaleiloes.com.br) — leiloeira oficial Liliamar Pestana Gomes, JUCISRS 168/00.
 * API JSON: /api/v2/leilao (agenda) → /leiloes/{id}/pregao (ids + lance atual) → /lote/cards-por-ids (dados).
 */
const BASE = "https://www.pestanaleiloes.com.br";
const API_PREGAO = "https://api.pestanaleiloes.com.br/sgl/v1//leiloes";
const FOTOS = "https://ged.pestanaleiloes.com.br/ged/";
const LOTE_CARDS = 100;

const SUBTIPOS: Record<number, TipoVeiculo> = { 481: "carro", 502: "carro", 483: "moto" }; // automóveis, camionetas, motos

export interface PestanaLeilao {
  id: number;
  nome: string;
  data: string;
  exposicao?: { cidade?: string; estado?: string }[];
}
interface Caracteristica {
  nome: string;
  valor: string;
}
export interface PestanaCard {
  id: number;
  leilao: number;
  numero?: string;
  descricao: string;
  status?: string;
  lanceInicial?: number;
  valorInicial?: number;
  seloLigaPartida?: boolean;
  seloIpvaPago?: boolean;
  seloFinanciamento?: boolean;
  tarjaEnchente?: boolean;
  bens?: {
    descricao?: string;
    origem?: string;
    subTipoBem?: { id: number; nome: string };
    imagens?: { media: string }[];
    caracteristicas?: Caracteristica[];
  }[];
  footer?: { date?: string };
}

const slug = (s: string) => normalizar(s).replace(/ /g, "-");

/** Junta os cards com o lance atual do pregão e o local do leilão. */
export function parsePestana(cards: PestanaCard[], lances: Map<number, number>, leilao: PestanaLeilao): LoteColetado[] {
  // local: só quando o leilão tem um único pátio (ou todos no mesmo estado)
  const exps = (leilao.exposicao ?? []).filter((e) => e.estado);
  const ufs = [...new Set(exps.map((e) => e.estado!.toUpperCase()))];
  const uf = ufs.length === 1 ? ufs[0] : undefined;
  const cidade = exps.length === 1 ? exps[0]!.cidade : undefined;

  const out: LoteColetado[] = [];
  for (const c of cards) {
    const bem = c.bens?.[0];
    const tipo = SUBTIPOS[bem?.subTipoBem?.id ?? 0];
    if (!bem || !tipo) continue;
    const car = (n: string) => bem.caracteristicas?.find((x) => normalizar(x.nome) === normalizar(n))?.valor;
    const monta = car("Monta");
    const condicao = car("Condição do bem");
    const [anoFab, anoMod] = anos(c.descricao.match(/\b(\d{4})\s+(\d{4})\b/)?.slice(1).join("/") ?? "");
    const partes = c.descricao.split(/\s+/);
    out.push({
      site: "pestana",
      idExterno: String(c.id),
      url: `${BASE}/agenda-de-leiloes/${c.leilao}/${c.id}/${slug(c.descricao)}`,
      titulo: c.descricao,
      tipo,
      marca: partes[0],
      modelo: partes.slice(1, 3).join(" "),
      descricao: bem.descricao,
      anoFab,
      anoMod,
      uf,
      cidade,
      condicaoTexto: [
        monta && !/n[aã]o se aplica/i.test(monta) ? `${monta} monta` : monta ? "sem monta" : null,
        condicao,
        c.seloLigaPartida ? "liga e da partida" : null,
        c.tarjaEnchente ? "enchente" : null,
      ]
        .filter(Boolean)
        .join(" . "),
      observacoes: [bem.descricao, condicao && `Condição: ${condicao}`, monta && `Monta: ${monta}`].filter(Boolean).join(" . "),
      procedenciaTexto: [bem.origem, leilao.nome].filter(Boolean).join(" . "),
      lanceAtual: lances.get(c.id) || c.valorInicial || c.lanceInicial,
      lanceInicial: c.lanceInicial ?? c.valorInicial,
      ipvaPago: c.seloIpvaPago || undefined,
      financiavel: c.seloFinanciamento || undefined,
      fimEm: dataBR((c.footer?.date ?? leilao.data).replace("T", " ")),
      status: c.status,
      fotos: (bem.imagens ?? []).slice(0, 8).map((i) => FOTOS + i.media),
      raw: { ...c, leilaoNome: leilao.nome },
    });
  }
  return out;
}

export const pestana: Adapter = {
  slug: "pestana",
  async listar({ page, log }) {
    await abrir(page, `${BASE}/agenda-de-leiloes`);
    const getJson = (url: string) =>
      page.evaluate(async (u) => {
        const r = await fetch(u, { headers: { accept: "application/json" } });
        if (!r.ok) throw new Error(`HTTP ${r.status} em ${u}`);
        return r.json();
      }, url);

    const leiloes = ((await getJson(`${BASE}/api/v2/leilao`)) as PestanaLeilao[]).filter(
      (l) => new Date(l.data).getTime() > Date.now() - 6 * 3600_000 && !/im[oó]ve/i.test(l.nome),
    );
    log(`${leiloes.length} leilões futuros (fora imóveis)`);

    const todos: LoteColetado[] = [];
    for (const l of leiloes) {
      await pausa();
      const preg = (await getJson(`${API_PREGAO}/${l.id}/pregao`).catch(() => null)) as {
        lotes?: { idLote: number; valorLanceAtual?: number }[];
      } | null;
      const ids = (preg?.lotes ?? []).map((x) => x.idLote);
      if (!ids.length) continue;
      const lances = new Map((preg?.lotes ?? []).map((x) => [x.idLote, x.valorLanceAtual ?? 0]));
      for (let i = 0; i < ids.length; i += LOTE_CARDS) {
        const cards = (await page.evaluate(
          async ({ url, ids }) => {
            const r = await fetch(url, {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              body: JSON.stringify({ ids }),
            });
            if (!r.ok) throw new Error(`cards-por-ids HTTP ${r.status}`);
            return r.json();
          },
          { url: `${BASE}/api/v2/lote/cards-por-ids`, ids: ids.slice(i, i + LOTE_CARDS) },
        )) as PestanaCard[];
        todos.push(...parsePestana(cards, lances, l));
        if (i + LOTE_CARDS < ids.length) await pausa();
      }
      log(`leilão ${l.id} "${l.nome.slice(0, 40)}": ${ids.length} lotes`);
    }
    return todos;
  },
};
