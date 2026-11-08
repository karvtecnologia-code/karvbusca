/** Minúsculas, sem acento, sem hífen/pontuação e com espaços colapsados. */
export function normalizar(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Versão compacta, sem espaços: "HR-V" e "hr v" viram "hrv". */
export function compactar(texto: string | null | undefined): string {
  return normalizar(texto).replace(/ /g, "");
}
