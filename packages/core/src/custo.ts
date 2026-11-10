export interface ParametrosCusto {
  lance: number;
  /** 5 = 5% */
  comissaoPct: number;
  taxaAdm?: number | null;
  patio?: number | null;
  frete?: number | null;
  documentacao?: number | null;
}

/** custo real = lance × (1 + comissão) + taxa adm + pátio + frete + documentação */
export function custoReal(p: ParametrosCusto): number {
  const v =
    p.lance * (1 + p.comissaoPct / 100) +
    (p.taxaAdm ?? 0) +
    (p.patio ?? 0) +
    (p.frete ?? 0) +
    (p.documentacao ?? 0);
  return Math.round(v * 100) / 100;
}

/** Frete: valor fixo de guincho, se houver; senão distância × R$/km. */
export function freteEstimado(opts: {
  distanciaKm?: number | null;
  porKm?: number | null;
  fixo?: number | null;
}): number {
  if (opts.fixo != null && opts.fixo > 0) return opts.fixo;
  if (opts.distanciaKm != null && opts.porKm != null) return Math.round(opts.distanciaKm * opts.porKm);
  return 0;
}

/** Dados mínimos de um lote/site/config para calcular o custo real (mesma regra no painel e no Telegram). */
export interface EntradaCusto {
  lance_atual: number | string | null;
  comissao_pct: number | string;
  taxa_adm: number | string;
  taxas_site?: number | string | null;
  custo_patio?: number | string | null;
  custo_doc?: number | string | null;
  custo_frete?: number | string | null;
  fipe_valor?: number | string | null;
  fipe_site?: number | string | null;
  distancia_km?: number | null;
}
export interface PadroesCusto {
  custo_doc_padrao: number | string;
  custo_patio_padrao: number | string;
  frete_padrao?: number | string | null;
  /** R$/km: com a distância do lote, vira o frete automático */
  frete_por_km?: number | string | null;
}

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

/** Custo real, FIPE e % FIPE com os valores do lote (se editados) ou os padrões. */
export function calcularLote(l: EntradaCusto, p: PadroesCusto) {
  const lance = num(l.lance_atual) ?? 0;
  const taxasSite = num(l.taxas_site);
  // a taxa da Loop já inclui estadia (pátio); nos outros sites usamos o padrão
  const patio = num(l.custo_patio) ?? (taxasSite != null ? 0 : num(p.custo_patio_padrao) ?? 0);
  const doc = num(l.custo_doc) ?? num(p.custo_doc_padrao) ?? 0;
  // frete: editado no lote > distância × R$/km > valor padrão
  const porKm = num(p.frete_por_km);
  const frete =
    num(l.custo_frete) ??
    (porKm && l.distancia_km != null ? Math.round(l.distancia_km * porKm) : null) ??
    num(p.frete_padrao) ??
    0;
  const comissaoPct = num(l.comissao_pct) ?? 5;
  const taxaAdm = (num(l.taxa_adm) ?? 0) + (taxasSite ?? 0);
  const custo = custoReal({ lance, comissaoPct, taxaAdm, patio, frete, documentacao: doc });
  const fipe = num(l.fipe_valor) ?? num(l.fipe_site);
  return {
    lance,
    comissao: Math.round(lance * comissaoPct) / 100,
    taxaAdm,
    patio,
    doc,
    frete,
    custo,
    fipe,
    pct: lance ? pctFipe(custo, fipe) : null,
  };
}

/** % FIPE = custo real / valor FIPE (0.7 = 70%). */
export function pctFipe(custo: number, fipe: number | null | undefined): number | null {
  if (!fipe || fipe <= 0) return null;
  return custo / fipe;
}
