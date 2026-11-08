import { PALAVRAS_MONTA, PALAVRAS_RODA } from "./keywords";
import { contemPalavra } from "./match";
import type { CondicaoMonta, Roda } from "./types";

const ORDEM_MONTA = ["sucata", "grande", "media", "pequena", "sem_monta"] as const;

export function classificarMonta(...textos: (string | null | undefined)[]): CondicaoMonta {
  const t = textos.filter(Boolean).join(" ");
  for (const nivel of ORDEM_MONTA) {
    if (PALAVRAS_MONTA[nivel].some((p) => contemPalavra(t, p))) return nivel;
  }
  return "nao_informado";
}

export function classificarRoda(...textos: (string | null | undefined)[]): Roda {
  const t = textos.filter(Boolean).join(" ");
  // remove as frases negativas antes de procurar as positivas
  if (PALAVRAS_RODA.nao.some((p) => contemPalavra(t, p))) return "nao";
  if (PALAVRAS_RODA.sim.some((p) => contemPalavra(t, p))) return "sim";
  return "nao_informado";
}
