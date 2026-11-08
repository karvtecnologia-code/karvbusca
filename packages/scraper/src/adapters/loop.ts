import { dataBR, extrairCidade, extrairUF, type LoteColetado, type TipoVeiculo } from "@karv/core";
import { pausa, pedir, type Adapter } from "../base";

const ORIGEM = "https://loopleiloes.com.br";
const API = "https://api.loopleiloes.com.br/search/leilao";
const FOTOS =
  "https://objectstorage.sa-saopaulo-1.oraclecloud.com/p/KwUyhjEv9VxIWkPo_Ql7FUmLthg8HKxwThZvvaed7_Tqz9QfJfwrzzgt_3EIvqRG/n/loopbrasil/b/vehicle-photos/o/md/";
const LOTE_API = 3000; // uma chamada só costuma cobrir todo o estoque

const TIPOS: Record<string, TipoVeiculo> = { leve: "carro", moto: "moto" };

interface LoopHit {
  _source: {
    sku?: string;
    lotId: number | null;
    url: string | null;
    lotStatus?: string;
    estimatedStartTime?: string;
    event?: { date?: string };
    lastBid?: number;
    location?: string;
    brand?: string;
    model?: string;
    version?: string;
    category?: string;
    fuel?: string;
    modelYear?: number;
    manufactureYear?: number;
    mileage?: number;
    image?: string;
    ipvaPaid?: boolean;
    isFinanciable?: boolean;
  };
}

export function parseLoop(json: { hits?: LoopHit[] }): LoteColetado[] {
  const out: LoteColetado[] = [];
  for (const { _source: s } of json.hits ?? []) {
    const tipo = TIPOS[(s.category ?? "").toLowerCase()];
    if (!tipo) continue;
    // sem lote = só estoque, ainda sem leilão marcado (não dá para dar lance)
    if (s.lotId == null || !s.url) continue;
    out.push({
      site: "loop",
      // o SKU é do veículo: continua o mesmo se ele for para outro leilão
      idExterno: s.sku ?? String(s.lotId),
      url: `https://loopleiloes.com.br/leilao/${s.url}`,
      titulo: [s.brand, s.model, s.version].filter(Boolean).join(" "),
      tipo,
      marca: s.brand,
      modelo: s.model,
      versao: s.version,
      anoFab: s.manufactureYear,
      anoMod: s.modelYear,
      km: s.mileage,
      uf: extrairUF(s.location),
      cidade: extrairCidade(s.location),
      combustivel: s.fuel,
      lanceAtual: s.lastBid,
      fimEm: dataBR(s.estimatedStartTime ?? s.event?.date),
      status: s.lotStatus,
      fotos: s.image ? [FOTOS + s.image] : [],
      ipvaPago: s.ipvaPaid,
      financiavel: s.isFinanciable,
      raw: s,
    });
  }
  return out;
}

interface LoopDetalhe {
  closingDate?: string;
  observation?: string;
  importantInfo?: unknown;
  inspectionInfo?: { label: string; description: string }[];
  fees?: { type: string; value: number }[];
  classification?: string;
  vehicle?: { fipePrice?: number; images?: ({ url?: string } | string)[] };
}

/** Lê o JSON do Next.js embutido na página de detalhe. */
export function parseLoopDetalhe(html: string, lote: LoteColetado): LoteColetado {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return lote;
  const queries = JSON.parse(m[1]!).props?.pageProps?.dehydratedState?.queries ?? [];
  const d: LoopDetalhe | undefined = queries
    .map((q: { state?: { data?: unknown } }) => q.state?.data)
    .find((x: LoopDetalhe | undefined) => x && "inspectionInfo" in x);
  if (!d) return lote;
  // A vistoria tem itens como "Sucata: Não"; o texto cru enganaria o classificador,
  // então traduzimos só os itens que importam pelo valor.
  const item = (re: RegExp) => d.inspectionInfo?.find((i) => re.test(i.label))?.description;
  const motor = item(/ligando.*motor|motor/i);
  const sucata = item(/^sucata$/i);
  const vistoria = [
    motor ? (/^funciona/i.test(motor) ? "motor funciona" : "motor nao funciona") : null,
    sucata && /^sim/i.test(sucata) ? "sucata" : null,
  ];
  const chaves = item(/^chaves?$/i);
  const taxas = (d.fees ?? []).filter((f) => f.type === "fixed").reduce((s, f) => s + f.value, 0);
  return {
    ...lote,
    fimEm: dataBR(d.closingDate) ?? lote.fimEm,
    condicaoTexto: vistoria.filter(Boolean).join(" . "),
    observacoes: d.observation,
    chave: chaves ? (/sem chave|nao possui|não possui/i.test(chaves) ? "nao" : "sim") : lote.chave,
    fipeSite: d.vehicle?.fipePrice ?? lote.fipeSite,
    taxasSite: taxas || undefined,
  };
}

export const loop: Adapter = {
  slug: "loop",
  async listar({ page, log }) {
    // a Loop recusa (429) a página /estoque vinda do IP do GitHub, mas a API responde;
    // então pedimos a API direto, como o navegador faria a partir do site
    const buscar = async (n: number) => JSON.parse(await pedir(page, `${API}?numero_veiculos=${n}`, ORIGEM));

    let n = LOTE_API;
    let json = await buscar(n);
    const total: number = json.total_found?.value ?? 0;
    while ((json.hits?.length ?? 0) < total && n < 5000) {
      n = Math.min(n + LOTE_API * 3, total);
      await pausa();
      json = await buscar(n);
      log(`pedido ${n}: ${json.hits?.length ?? 0} de ${total}`);
      if ((json.hits?.length ?? 0) < n) break; // a API tem limite próprio
    }
    const lotes = parseLoop(json);
    log(`${json.hits?.length ?? 0} lotes lidos, ${lotes.length} carros/motos (total ${total})`);
    return lotes;
  },
  async detalhar({ page }, lote) {
    // o JSON do Next.js vem pronto no HTML do servidor: não precisa executar a página
    const html = await pedir(page, lote.url, ORIGEM);
    await pausa();
    return parseLoopDetalhe(html, lote);
  },
};
