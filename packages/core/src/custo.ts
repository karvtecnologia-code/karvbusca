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

/** % FIPE = custo real / valor FIPE (0.7 = 70%). */
export function pctFipe(custo: number, fipe: number | null | undefined): number | null {
  if (!fipe || fipe <= 0) return null;
  return custo / fipe;
}
