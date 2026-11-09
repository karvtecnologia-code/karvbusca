import { dataBR, dinheiro, extrairCidade, extrairUF, type LoteColetado, type TipoVeiculo } from "@karv/core";
import { abrir, pausa, type Adapter } from "../base";
import consulta from "./sodre-query.json" with { type: "json" };

const LISTA = "https://www.sodresantoro.com.br/veiculos/lotes";
const POR_PAGINA = 48;

const TIPOS: Record<string, TipoVeiculo> = {
  carros: "carro",
  "utilitarios leves": "carro",
  peruas: "carro",
  "van leve": "carro",
  motos: "moto",
};

interface SodreLote {
  id: string;
  lot_id: number;
  auction_id: number;
  lot_title?: string;
  lot_brand?: string;
  lot_model?: string;
  lot_description?: string;
  lot_category?: string;
  lot_location?: string;
  lot_sinister?: string;
  lot_is_scrap?: boolean;
  lot_km?: number;
  lot_fuel?: string;
  lot_year_manufacture?: number;
  lot_year_model?: number;
  lot_pictures?: string[] | null;
  lot_optionals?: string[] | null;
  lot_origin?: string | null;
  lot_tags?: string | null;
  lot_status?: string;
  lot_status_financeable?: boolean;
  lot_date_end?: string | null;
  auction_date_init?: string;
  auction_name?: string;
  client_name?: string;
  bid_initial?: string;
  bid_actual?: string;
}

export function parseSodre(json: { results: SodreLote[] }): LoteColetado[] {
  const out: LoteColetado[] = [];
  for (const r of json.results ?? []) {
    const tipo = TIPOS[(r.lot_category ?? "").toLowerCase()];
    if (!tipo) continue;
    const condicao = [r.lot_sinister, r.lot_is_scrap ? "sucata" : null].filter(Boolean).join(" . ");
    out.push({
      site: "sodre",
      idExterno: String(r.lot_id),
      url: `https://leilao.sodresantoro.com.br/leilao/${r.auction_id}/lote/${r.lot_id}/`,
      titulo: (r.lot_title ?? `${r.lot_brand} ${r.lot_model}`).toUpperCase(),
      tipo,
      marca: r.lot_brand,
      modelo: r.lot_model,
      descricao: r.lot_description,
      anoFab: r.lot_year_manufacture,
      anoMod: r.lot_year_model,
      km: r.lot_km || undefined, // a Sodré manda 0 quando não sabe
      uf: extrairUF(r.lot_location),
      cidade: extrairCidade(r.lot_location),
      condicaoTexto: condicao,
      combustivel: r.lot_fuel,
      lanceAtual: dinheiro(r.bid_actual) || dinheiro(r.bid_initial),
      lanceInicial: dinheiro(r.bid_initial),
      fimEm: dataBR(r.lot_date_end ?? r.auction_date_init),
      status: r.lot_status,
      fotos: r.lot_pictures ?? [],
      observacoes: r.lot_description,
      chave: r.lot_optionals?.includes("chave-ignicao") ? "sim" : undefined,
      financiavel: r.lot_status_financeable,
      ipvaPago: /ipva \d{4} pago/i.test(`${r.lot_tags ?? ""} ${r.lot_description ?? ""}`) || undefined,
      procedenciaTexto: [r.lot_origin, r.client_name, r.auction_name].filter(Boolean).join(" . "),
      raw: r,
    });
  }
  return out;
}

export const sodre: Adapter = {
  slug: "sodre",
  async listar({ page, log }) {
    await abrir(page, LISTA);
    const todos: LoteColetado[] = [];
    let from = 0;
    let total = Infinity;
    while (from < total) {
      const corpo = { ...consulta, from, size: POR_PAGINA };
      const json = await page.evaluate(async (body) => {
        const r = await fetch("/api/search-lots", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`search-lots HTTP ${r.status}`);
        return r.json();
      }, corpo);
      total = json.total ?? 0;
      const lote = parseSodre(json);
      todos.push(...lote);
      log(`página ${from / POR_PAGINA + 1}: ${json.results?.length ?? 0} lotes (total ${total})`);
      if (!json.results?.length) break;
      from += POR_PAGINA;
      if (from < total) await pausa();
    }
    return todos;
  },
};
