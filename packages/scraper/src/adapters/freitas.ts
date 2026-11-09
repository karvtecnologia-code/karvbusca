import * as cheerio from "cheerio";
import { anos, dataBR, dinheiro, type LoteColetado, type TipoVeiculo } from "@karv/core";
import { abrir, linhas, pausa, textoVisivel, type Adapter } from "../base";

const BASE = "https://www.freitasleiloeiro.com.br";
const POR_PAGINA = 12;
const MAX_PAGINAS = 60;
/** Filtro "Condição" do site → texto que o classificador entende. */
const CONDICOES: [string, string][] = [
  ["inteiros", "sem monta"],
  ["pequena monta", "pequena monta"],
  ["media monta", "media monta"],
  ["sucatas", "sucata"],
];
const TIPOS: [number, TipoVeiculo][] = [
  [1, "carro"],
  [3, "moto"],
];

/** Lê os cards (.cardlote) da listagem ou do HTML parcial de /Leiloes/PesquisarLotes. */
export function parseFreitasLista(html: string, tipo?: TipoVeiculo): LoteColetado[] {
  const $ = cheerio.load(html);
  const out: LoteColetado[] = [];
  $(".cardlote").each((_, el) => {
    const c = $(el);
    const href = c.find("a[href*='LoteDetalhes']").first().attr("href");
    const m = href?.match(/leilaoId=(\d+)&(?:amp;)?loteNumero=(\d+)/);
    if (!href || !m) return;
    // "I MMC ASX…": o "I" marca importado; tiramos do título
    const desc = c.find(".cardLote-descVeic").text().replace(/\s+/g, " ").trim().replace(/^I[\s/]+/, "");
    // "HONDA/FIT EX CVT, 15/16, PLACA: L__-___8, GASOL/ALC, CINZA"
    const partes = desc.split(",").map((p) => p.trim());
    const [marca, ...resto] = (partes[0] ?? "").split("/");
    const [anoFab, anoMod] = anos(partes[1]);
    const datas = c.find(".cardLote-data span").map((_, s) => $(s).text().trim()).get();
    const detalhes = c.find(".cardLote-details").text().replace(/\s+/g, " ").trim();
    const valor = dinheiro(c.find(".cardLote-vlr").text());
    const rotulo = c.find(".cardLote-lance").text().trim().toLowerCase();
    out.push({
      site: "freitas",
      idExterno: `${m[1]}-${m[2]}`,
      url: BASE + href.replace(/&amp;/g, "&"),
      titulo: partes[0]?.replace("/", " ") ?? desc,
      tipo,
      marca: marca?.trim(),
      modelo: resto.join("/").trim() || undefined,
      descricao: desc,
      anoFab,
      anoMod,
      uf: "SP", // os pátios da Freitas ficam em SP (Utinga, Santo André, Santa Bárbara)
      combustivel: partes[3],
      lanceAtual: valor,
      lanceInicial: rotulo.includes("inicial") ? valor : undefined,
      fimEm: dataBR(datas[0], datas[1]),
      fotos: [c.find("img.cardLote-img").attr("src")].filter(Boolean) as string[],
      condicaoTexto: detalhes,
      procedenciaTexto: detalhes,
      raw: { href, desc, detalhes, datas },
    });
  });
  return out;
}

/** Lê a página de detalhe (texto visível): condições de venda, que avisam "CIRCUL VEDADA". */
export function parseFreitasDetalhe(texto: string, lote: LoteColetado): LoteColetado {
  const ls = linhas(texto);
  const i = ls.findIndex((l) => /^Leia atentamente/i.test(l));
  const cond = i >= 0 ? ls[i + 1] : undefined;
  const local = ls.find((l) => /^P[aá]tio\b|^Local de exposi/i.test(l));
  const cidade = local?.match(/-\s*([^-/]+)\/SP/i)?.[1]?.trim();
  return {
    ...lote,
    cidade: cidade ?? lote.cidade,
    condicaoTexto: [lote.condicaoTexto, cond].filter(Boolean).join(" . "),
    observacoes: cond,
  };
}

export const freitas: Adapter = {
  slug: "freitas",
  async listar({ page, log }) {
    await abrir(page, `${BASE}/Leiloes/Pesquisar?Categoria=1&TipoLoteId=1`);
    const vistos = new Map<string, LoteColetado>();
    // buscamos por condição (filtro oficial do site) para marcar a monta de cada lote
    for (const [tipoId, tipo] of TIPOS)
    for (const [condicao, rotulo] of CONDICOES) {
      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        const p = new URLSearchParams({
          Nome: "",
          Categoria: "1",
          TipoLoteId: String(tipoId),
          FaixaValor: "0",
          Condicao: condicao,
          PatioId: "0",
          AnoModeloMin: "0",
          AnoModeloMax: "0",
          ArCondicionado: "false",
          DirecaoAssistida: "false",
          Tag: "",
          Estado: "",
          Cidade: "",
          ClienteSclId: "0",
          PageNumber: String(pagina),
          TopRows: String(POR_PAGINA),
        });
        const html = await page.evaluate(async (url) => {
          const r = await fetch(url, { headers: { "x-requested-with": "XMLHttpRequest" } });
          if (!r.ok) throw new Error(`PesquisarLotes HTTP ${r.status}`);
          return r.text();
        }, `/Leiloes/PesquisarLotes?${p}`);
        if (html.includes("Nenhum lote localizado")) break;
        const cards = parseFreitasLista(html, tipo).map((c) => ({
          ...c,
          condicaoTexto: [rotulo, c.condicaoTexto].join(" . "),
        }));
        const novos = cards.filter((c) => !vistos.has(c.idExterno));
        for (const c of cards) vistos.set(c.idExterno, c);
        log(`${tipo} ${condicao} p${pagina}: ${cards.length} lotes`);
        if (cards.length < POR_PAGINA || !novos.length) break;
        await pausa();
      }
    }
    return [...vistos.values()];
  },
  async detalhar({ page }, lote) {
    await abrir(page, lote.url);
    return parseFreitasDetalhe(await textoVisivel(page), lote);
  },
};
