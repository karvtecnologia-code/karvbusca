import {
  PALAVRAS_CIRCULACAO_LIBERADA,
  PALAVRAS_CIRCULACAO_VEDADA,
  PALAVRAS_DANO_ESTRUTURAL,
  PALAVRAS_MONTA,
  PALAVRAS_PROCEDENCIA,
  PALAVRAS_RODA,
} from "./keywords";
import { contemPalavra } from "./match";
import type { CondicaoMonta, Roda } from "./types";

type Texto = string | null | undefined;
const juntar = (t: Texto[]) => t.filter(Boolean).join(" . ");

const ORDEM_MONTA = ["sucata", "grande", "media", "pequena", "sem_monta"] as const;

export function classificarMonta(...textos: Texto[]): CondicaoMonta {
  const t = juntar(textos);
  for (const nivel of ORDEM_MONTA) {
    if (PALAVRAS_MONTA[nivel].some((p) => contemPalavra(t, p))) return nivel;
  }
  return "nao_informado";
}

export function classificarRoda(...textos: Texto[]): Roda {
  const t = juntar(textos);
  if (PALAVRAS_RODA.nao.some((p) => contemPalavra(t, p))) return "nao";
  if (PALAVRAS_RODA.sim.some((p) => contemPalavra(t, p))) return "sim";
  return "nao_informado";
}

export type Circulacao = "liberada" | "vedada" | "nao_informado";
export function classificarCirculacao(...textos: Texto[]): Circulacao {
  const t = juntar(textos);
  if (PALAVRAS_CIRCULACAO_VEDADA.some((p) => contemPalavra(t, p))) return "vedada";
  if (PALAVRAS_CIRCULACAO_LIBERADA.some((p) => contemPalavra(t, p))) return "liberada";
  return "nao_informado";
}

/** Devolve os termos de dano estrutural encontrados (vazio = nenhum). */
export function danosEstruturais(...textos: Texto[]): string[] {
  const t = juntar(textos);
  return PALAVRAS_DANO_ESTRUTURAL.filter((p) => contemPalavra(t, p));
}

export type Procedencia =
  | "financiamento" | "seguradora" | "patrimonio" | "judicial" | "apreensao" | "frota" | "particular" | "nao_informado";
export function classificarProcedencia(...textos: Texto[]): Procedencia {
  const t = juntar(textos);
  for (const [tipo, palavras] of Object.entries(PALAVRAS_PROCEDENCIA)) {
    if (palavras.some((p) => contemPalavra(t, p))) return tipo as Procedencia;
  }
  return "nao_informado";
}

/** Regra do "dá para rodar": sem sucata/grande monta, motor não parado, circulação não vedada, sem dano estrutural. */
export function aptoRodar(c: {
  monta: CondicaoMonta;
  roda: Roda;
  circulacao: Circulacao;
  danoEstrutural: boolean;
}): boolean {
  if (c.monta === "sucata" || c.monta === "grande") return false;
  if (c.roda === "nao") return false;
  if (c.circulacao === "vedada") return false;
  if (c.danoEstrutural) return false;
  return true;
}
