import { anos, dataBR, dinheiro, inteiro, ufPorNome, type LoteColetado } from "@karv/core";
import { abrir, campo, linhas, pausa, textoVisivel, type Adapter } from "../base";

const LISTA = "https://www.sold.com.br/categorias/carros-motos";
const POR_PAGINA = 50;

function urlOfertas(pagina: number) {
  const p = new URLSearchParams({
    portalId: "[2,15]",
    requestOrigin: "store",
    locale: "pt_BR",
    timeZoneId: "America/Sao_Paulo",
    searchType: "opened",
    // Superbid inteiro (a Sold é uma das lojas dele): ~15x mais estoque, sem duplicar lotes
    filter: "product.productType.description:carros-motos",
    pageNumber: String(pagina),
    pageSize: String(POR_PAGINA),
    orderBy: "endDate:asc",
  });
  return `https://offer-query.superbid.net/offers/?${p}`;
}

interface Propriedade {
  id: string;
  value?: unknown;
}
interface SoldOferta {
  id: number;
  endDate?: string;
  price?: number;
  linkURL?: string;
  offerStatus?: { closed?: boolean; sold?: boolean };
  offerDetail?: { initialBidValue?: number; currentMaxBid?: number; reservedPrice?: number };
  store?: { id?: number; name?: string };
  offerDescription?: { offerDescription?: string };
  seller?: { name?: string };
  product?: {
    shortDesc?: string;
    thumbnailUrl?: string;
    galleryJson?: { link?: string; type?: string }[];
    template?: { groups?: { properties?: Propriedade[] }[] };
    location?: { city?: string; state?: string };
    subCategory?: { description?: string };
  };
}

/** Texto do offerDescription sem HTML. */
function descricao(o: SoldOferta): string {
  return (o.offerDescription?.offerDescription ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function prop(o: SoldOferta, id: string): string | undefined {
  for (const g of o.product?.template?.groups ?? [])
    for (const p of g.properties ?? []) if (p.id === id && p.value) return String(p.value);
  return undefined;
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, "") // a Sold tira os pontos: "1.0L" → "10l"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseSold(json: { offers?: SoldOferta[] }): LoteColetado[] {
  const veiculos = (json.offers ?? []).filter(
    (o) => !/pe[cç]as|acess[oó]rio/i.test(o.product?.subCategory?.description ?? ""),
  );
  return veiculos.map((o) => {
    const desc = (o.product?.shortDesc ?? "").trim();
    const [anoFab, anoMod] = anos(desc);
    const titulo = desc.split(",")[0]!.trim();
    const fotos = (o.product?.galleryJson ?? [])
      .filter((g) => g.type !== "video" && g.link)
      .map((g) => g.link!) as string[];
    const texto = descricao(o);
    const obs = texto.match(/Observa[cç][oõ]es:\s*([\s\S]*?)(?:Ser[aá] de responsabilidade|$)/i)?.[1]?.trim();
    const fipe = texto.match(/FIPE informada:\s*(R\$\s*[\d.,]+)/i)?.[1];
    const sub = (o.product?.subCategory?.description ?? "").toLowerCase();
    return {
      site: "sold" as const,
      idExterno: String(o.id),
      // superbid.net abre ofertas de qualquer loja (a Sold só abre as dela)
      url: o.linkURL ?? `https://www.superbid.net/oferta/${slug(desc)}-${o.id}`,
      titulo,
      // subcategorias: Sedans, Hatches, Picapes, SUVs… = carro; Motocicletas = moto
      tipo: /moto/.test(sub) ? ("moto" as const) : sub ? ("carro" as const) : undefined,
      marca: prop(o, "marca") ?? titulo.split(" ")[0],
      modelo: prop(o, "modelo"),
      descricao: desc,
      anoFab: inteiro(prop(o, "anofabricacao")) ?? anoFab,
      anoMod: inteiro(prop(o, "anomodelo")) ?? anoMod,
      // estado/cidade do bem; quando falta o estado, o detalhe completa
      uf: ufPorNome(o.product?.location?.state),
      cidade: o.product?.location?.city?.replace(/\s*-\s*[A-Z]{2}\s*$/, ""), // "Porto Feliz - SP" → "Porto Feliz"
      condicaoTexto: obs,
      observacoes: obs,
      fipeSite: dinheiro(fipe),
      procedenciaTexto: o.seller?.name,
      lanceAtual: o.offerDetail?.currentMaxBid ?? o.price,
      lanceInicial: o.offerDetail?.initialBidValue,
      // preço de reserva: abaixo dele o vendedor não vende (999.999.999 = sem reserva)
      avaliacao: (o.offerDetail?.reservedPrice ?? 0) > 0 && (o.offerDetail?.reservedPrice ?? 0) < 900_000_000 ? o.offerDetail!.reservedPrice : undefined,
      fimEm: dataBR(o.endDate),
      status: o.offerStatus?.closed ? "encerrado" : "aberto",
      fotos: fotos.length ? fotos : o.product?.thumbnailUrl ? [o.product.thumbnailUrl] : [],
      raw: o,
    };
  });
}

/** Lê a página de detalhe (texto visível). */
export function parseSoldDetalhe(texto: string, lote: LoteColetado): LoteColetado {
  const ls = linhas(texto);
  // "Localização Cachoeirinha - RS • Lote 6" ou só "Localização Pinhais • Lote 51"
  const loc = ls
    .map((l) => l.match(/^Localiza[cç][aã]o\s+(.+?)(?:\s*-\s*([A-Z]{2}))?\s*(?:•|$)/))
    .find(Boolean);
  const motor = campo(ls, "Motor");
  const chave = campo(ls, "Chave principal");
  const iObs = ls.findIndex((l) => /^Condi[cç][oõ]es Gerais$/i.test(l));
  const iFim = ls.findIndex((l, i) => i > iObs && /^Ser[aá] de responsabilidade/i.test(l));
  const obs = iObs >= 0 ? ls.slice(iObs + 1, iFim > iObs ? iFim : iObs + 20).join(" . ") : undefined;
  const km = campo(ls, "Quilometragem") ?? campo(ls, "KM");
  return {
    ...lote,
    cidade: loc?.[1] ?? lote.cidade,
    uf: loc?.[2] ?? lote.uf,
    km: inteiro(km) ?? lote.km,
    condicaoTexto: [motor ? `motor ${motor}` : null, obs].filter(Boolean).join(" . "),
    observacoes: obs,
    chave: chave ? (/^sim/i.test(chave) ? "sim" : "nao") : lote.chave,
  };
}

export const sold: Adapter = {
  slug: "sold",
  async listar({ page, log }) {
    await abrir(page, LISTA);
    const todos: LoteColetado[] = [];
    for (let pagina = 1; pagina < 100; pagina++) {
      const json = await page.evaluate(async (url) => {
        const r = await fetch(url, { headers: { accept: "application/json" } });
        if (!r.ok) throw new Error(`offers HTTP ${r.status}`);
        return r.json();
      }, urlOfertas(pagina));
      const lote = parseSold(json);
      const brutas = json.offers?.length ?? 0; // conta antes de tirar as peças
      todos.push(...lote);
      log(`página ${pagina}: ${brutas} ofertas, ${lote.length} veículos (total ${json.total})`);
      if (brutas < POR_PAGINA || pagina * POR_PAGINA >= (json.total ?? 0)) break;
      await pausa();
    }
    return todos;
  },
  async detalhar({ page }, lote) {
    // a API já traz local, condição e FIPE; o detalhe só completa quando falta o estado
    if (lote.uf) return lote;
    await abrir(page, lote.url);
    const d = parseSoldDetalhe(await textoVisivel(page), lote);
    return { ...d, condicaoTexto: [lote.condicaoTexto, d.condicaoTexto].filter(Boolean).join(" . ") };
  },
};
