import { normalizar } from "./normalize";
import type { LoteColetado } from "./types";

/**
 * Filtros extras de busca: valem para cada termo (aba Termos) e para o modo descoberta.
 * Tudo opcional: campo vazio = não filtra. Guardado como JSON (termos_busca.filtros,
 * config.descoberta_filtros).
 */
export interface FiltrosBusca {
  anoMin?: number | null;
  anoMax?: number | null;
  lanceMin?: number | null;
  lanceMax?: number | null;
  kmMax?: number | null;
  /** valor da FIPE do veículo (R$) */
  fipeMin?: number | null;
  fipeMax?: number | null;
  /** lance ÷ FIPE máximo (0,7 = até 70% da FIPE) */
  pctFipeMax?: number | null;
  cores?: string[];
  /** financiamento, frota, patrimonio, particular, judicial, apreensao, seguradora, nao_informado */
  procedencias?: string[];
  /** sem_monta, pequena, media, nao_informado (grande e sucata nunca entram como aptos) */
  montas?: string[];
  combustiveis?: string[];
  ufs?: string[];
  /** só lotes que informam ter chave */
  comChave?: boolean;
}

export const CORES = [
  "branco", "preto", "prata", "cinza", "grafite", "vermelho", "vinho", "azul",
  "verde", "amarelo", "laranja", "bege", "marrom", "dourado", "rosa", "roxo",
] as const;

const SINONIMOS: Record<string, string> = {
  branca: "branco", preta: "preto", prateado: "prata", prateada: "prata", cinzento: "cinza",
  vermelha: "vermelho", amarela: "amarelo", dourada: "dourado", roxa: "roxo", chumbo: "grafite",
};

/** Cor do veículo achada no texto do lote ("Cor: Prata", "branca", "preto fosco"…). */
export function extrairCor(...textos: (string | null | undefined)[]): string | null {
  const t = textos.filter(Boolean).join(" ");
  if (!t) return null;
  // primeiro o campo explícito "cor: xxx"
  const m = t.match(/\bcor(?:\s+predominante)?\s*[:\-]\s*([a-zà-ú]+)/i);
  if (m) {
    const c = m[1]!.toLowerCase();
    const norm = SINONIMOS[c] ?? c;
    if ((CORES as readonly string[]).includes(norm)) return norm;
  }
  const palavras = new Set(normalizar(t).split(" "));
  for (const c of [...CORES, ...Object.keys(SINONIMOS)]) if (palavras.has(c)) return SINONIMOS[c] ?? c;
  return null;
}

/** Quantos filtros estão preenchidos (para mostrar "3 filtros"). */
export function contarFiltros(f: FiltrosBusca | null | undefined): number {
  if (!f) return 0;
  return Object.values(f).filter((v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== false && v !== "")).length;
}

export interface DadosFiltro {
  ano?: number | null;
  lance?: number | null;
  km?: number | null;
  /** FIPE conhecida agora (do site ou do cache); ausente = filtros de FIPE não barram */
  fipe?: number | null;
  cor?: string | null;
  procedencia?: string | null;
  monta?: string | null;
  combustivel?: string | null;
  uf?: string | null;
  chave?: string | null;
}

/**
 * Confere os filtros. Dado que o lote não informa (ano, km, cor…) NÃO barra: melhor mostrar
 * um lote incompleto do que perder um bom por falta de informação no site.
 */
export function passaFiltros(d: DadosFiltro, f: FiltrosBusca | null | undefined): boolean {
  if (!f) return true;
  const fora = (v: number | null | undefined, min?: number | null, max?: number | null) =>
    v != null && ((min != null && v < min) || (max != null && v > max));
  if (fora(d.ano, f.anoMin, f.anoMax)) return false;
  if (fora(d.lance, f.lanceMin, f.lanceMax)) return false;
  if (fora(d.km, null, f.kmMax)) return false;
  if (fora(d.fipe, f.fipeMin, f.fipeMax)) return false;
  if (f.pctFipeMax != null && d.fipe && d.lance && d.lance / d.fipe > f.pctFipeMax) return false;
  const lista = (v: string | null | undefined, l?: string[]) =>
    !l?.length || v == null || v === "nao_informado" || l.includes(v);
  if (!lista(d.cor, f.cores)) return false;
  if (f.procedencias?.length && !f.procedencias.includes(d.procedencia ?? "nao_informado")) return false;
  if (f.montas?.length && !f.montas.includes(d.monta ?? "nao_informado")) return false;
  if (!lista(d.combustivel ? d.combustivel.toLowerCase() : null, f.combustiveis)) return false;
  if (!lista(d.uf, f.ufs)) return false;
  if (f.comChave && d.chave === "nao") return false;
  return true;
}

/** Atalho para um lote recém-coletado (antes de ir ao banco). */
export function dadosDoColetado(l: LoteColetado, extra: Partial<DadosFiltro> = {}): DadosFiltro {
  return {
    ano: l.anoMod ?? l.anoFab ?? null,
    lance: l.lanceAtual ?? null,
    km: l.km ?? null,
    fipe: l.fipeSite ?? null,
    combustivel: l.combustivel ?? null,
    uf: l.uf ?? null,
    chave: l.chave ?? null,
    ...extra,
  };
}
