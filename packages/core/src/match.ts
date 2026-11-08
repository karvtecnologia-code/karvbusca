import { normalizar } from "./normalize";
import type { LoteColetado, TermoBusca } from "./types";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Verifica se `agulha` aparece como palavra(s) inteira(s) em `palheiro`,
 * depois de normalizar os dois. Aceita variações com e sem espaço:
 * "hr v" casa com "hrv" e vice-versa.
 */
export function contemPalavra(palheiro: string, agulha: string): boolean {
  const h = normalizar(palheiro);
  const n = normalizar(agulha);
  if (!h || !n) return false;
  const compacta = n.replace(/ /g, "");
  // cada caractere da forma compacta pode ter um espaço opcional depois dele
  const flex = compacta.split("").map(escapeRe).join(" ?");
  const re = new RegExp(`(?:^| )${flex}(?: |$)`);
  return re.test(h);
}

export function termoCasaTexto(
  texto: string,
  termo: Pick<TermoBusca, "termo" | "apelidos">,
): boolean {
  return [termo.termo, ...termo.apelidos].some((t) => contemPalavra(texto, t));
}

/** Devolve os termos ativos que casam com o lote (nome + filtros de tipo, ano e lance). */
export function casarTermos(lote: LoteColetado, termos: TermoBusca[]): TermoBusca[] {
  const texto = [lote.titulo, lote.marca, lote.modelo, lote.versao, lote.descricao]
    .filter(Boolean)
    .join(" ");
  const ano = lote.anoMod ?? lote.anoFab;
  return termos.filter((t) => {
    if (!t.ativo) return false;
    if (!termoCasaTexto(texto, t)) return false;
    if (t.tipo && lote.tipo && t.tipo !== lote.tipo) return false;
    if (ano != null && t.anoMin != null && ano < t.anoMin) return false;
    if (ano != null && t.anoMax != null && ano > t.anoMax) return false;
    if (lote.lanceAtual != null && t.lanceMax != null && lote.lanceAtual > t.lanceMax) return false;
    return true;
  });
}
