import { normalizar } from "@karv/core";

/** Lista oficial de municípios do IBGE (API pública e gratuita). */
const IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado";

let cache: Promise<Map<string, Set<string>>> | null = null;

function carregar() {
  cache ??= fetch(IBGE)
    .then((r) => {
      if (!r.ok) throw new Error(`IBGE HTTP ${r.status}`);
      return r.json() as Promise<{ "municipio-nome": string; "UF-sigla": string }[]>;
    })
    .then((lista) => {
      const m = new Map<string, Set<string>>();
      for (const x of lista) {
        const k = normalizar(x["municipio-nome"]);
        if (!m.has(k)) m.set(k, new Set());
        m.get(k)!.add(x["UF-sigla"]);
      }
      return m;
    })
    .catch(() => new Map()); // sem internet para o IBGE: segue sem completar
  return cache;
}

/** UF de uma cidade, se o nome existir em um único estado. */
export async function ufPorCidade(cidade?: string | null): Promise<string | undefined> {
  if (!cidade) return undefined;
  const ufs = (await carregar()).get(normalizar(cidade));
  return ufs && ufs.size === 1 ? [...ufs][0] : undefined;
}
