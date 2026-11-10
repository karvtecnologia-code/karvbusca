import * as cheerio from "cheerio";
import { anos, dataBR, dinheiro, type LoteColetado, type TipoVeiculo } from "@karv/core";
import { abrir, linhas, pausa, textoVisivel, type Adapter } from "../base";

/**
 * Mega Leilões (megaleiloes.com.br) — leiloeiro oficial Fernando José Cerello Gonçalves Pereira, JUCESP 844.
 * Sem API: lê os cards das listagens /veiculos/carros e /veiculos/motos (HTML do servidor).
 */
const BASE = "https://www.megaleiloes.com.br";
const CATEGORIAS: [string, TipoVeiculo][] = [
  ["carros", "carro"],
  ["motos", "moto"],
];
const MAX_PAGINAS = 15;
const UFS_BR = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

export function parseMegaLista(html: string, tipo: TipoVeiculo): LoteColetado[] {
  const $ = cheerio.load(html);
  const out: LoteColetado[] = [];
  $("[data-key] .card").each((_, el) => {
    const c = $(el);
    const href = c.find("a.card-title").attr("href")?.split("?")[0];
    const numero = c.find(".card-number").text().trim();
    if (!href || !numero) return;
    const titulo = c.find("a.card-title").text().trim().replace(/^(carro|moto|motocicleta)\s+/i, "");
    // "Direitos sobre…": compra-se o direito, não o veículo (risco alto para quem quer rodar)
    if (/^direitos?\b/i.test(titulo)) return;
    // "Canguçu, RS"
    const [cidade, uf] = c.find(".card-locality").text().split(",").map((s) => s.trim());
    // praças: a ativa é a que está aberta agora; a anterior (se houver) era mais cara
    const pracas = c
      .find(".instance")
      .map((_, i) => {
        const p = $(i);
        const quando = p.text().match(/(\d{2}\/\d{2}\/\d{4})\s*às\s*(\d{2}:\d{2})/);
        return {
          ativa: p.hasClass("active"),
          fim: quando ? dataBR(quando[1], quando[2]) : undefined,
          valor: dinheiro(p.find(".card-instance-value").text()),
        };
      })
      .get();
    const ativa = pracas.find((p) => p.ativa) ?? pracas[pracas.length - 1];
    const primeira = pracas[0];
    const [af, am] = anos(titulo);
    // "Fox 1.6 - 2013": um ano só (o último que aparece no título)
    const anoUnico = Number(titulo.match(/\b(19|20)\d{2}\b(?!.*\b(19|20)\d{2}\b)/)?.[0]) || undefined;
    const [anoFab, anoMod] = am ? [af, am] : [anoUnico, anoUnico];
    const img = c.find(".card-image").attr("data-bg");
    out.push({
      site: "mega",
      idExterno: numero,
      url: href,
      titulo,
      tipo,
      marca: titulo.split(/[\s,]+/)[0],
      anoFab,
      anoMod,
      uf: uf && UFS_BR.includes(uf) ? uf : undefined, // "NI"/"SI" = não informado
      cidade: cidade && !/inform/i.test(cidade) ? cidade : undefined,
      lanceAtual: dinheiro(c.find(".card-price").text()),
      // 2ª praça: o lance mínimo da praça anterior era maior
      lanceInicial: ativa?.valor ?? undefined,
      fimEm: ativa?.fim,
      status: c.find(".card-status").text().trim() || undefined,
      procedenciaTexto: c.find(".card-instance-title a").first().text().trim(), // "Judicial"
      fotos: img && !/no-image/.test(img) ? [img] : [],
      raw: { href, numero, pracas, primeiraPraca: primeira?.valor },
    });
  });
  return out;
}

/** Página do lote: a descrição traz a condição (texto visível). */
export function parseMegaDetalhe(texto: string, lote: LoteColetado): LoteColetado {
  const ls = linhas(texto);
  // a descrição do lote começa com "LOTE 01: um veículo…"; sem isso, a linha mais longa que fala do bem
  const i = ls.findIndex((l) => /^lote\s*\d+\s*:/i.test(l));
  const desc =
    i >= 0
      ? ls.slice(i, i + 4).join(" . ").slice(0, 2500)
      : ls.filter((l) => l.length > 80 && /ve[ií]culo|motor|chassi|placa|ano/i.test(l)).sort((a, b) => b.length - a.length)[0];
  const [anoFab, anoMod] = lote.anoMod ? [lote.anoFab, lote.anoMod] : anos(desc ?? "");
  return { ...lote, anoFab, anoMod, descricao: desc, observacoes: desc, condicaoTexto: desc };
}

export const mega: Adapter = {
  slug: "mega",
  async listar({ page, log }) {
    const todos: LoteColetado[] = [];
    for (const [cat, tipo] of CATEGORIAS) {
      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        await abrir(page, `${BASE}/veiculos/${cat}?pagina=${pagina}`);
        const lotes = parseMegaLista(await page.content(), tipo);
        todos.push(...lotes);
        log(`${cat} p${pagina}: ${lotes.length} lotes`);
        const temProxima = await page.locator(".pagination li.next:not(.disabled)").count();
        if (!lotes.length || !temProxima) break;
        await pausa();
      }
    }
    return todos;
  },
  async detalhar({ page }, lote) {
    await abrir(page, lote.url);
    return parseMegaDetalhe(await textoVisivel(page), lote);
  },
};
