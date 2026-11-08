/**
 * Palavras-chave de classificação. EDITE AQUI à vontade.
 * Tudo é comparado depois de normalizado (sem acento, minúsculo, palavra inteira).
 * A ordem de checagem fica em classify.ts: o mais grave vence.
 */
export const PALAVRAS_MONTA = {
  sucata: ["sucata", "baixa definitiva", "irrecuperavel", "para desmonte", "so pecas"],
  grande: ["grande monta", "danos de grande", "dano de grande"],
  media: ["media monta", "danos de media", "dano de media"],
  pequena: ["pequena monta", "danos de pequena", "dano de pequena"],
  sem_monta: [
    "sem monta",
    "sem registro de monta",
    "nao consta monta",
    "sem sinistro",
    "recuperado de financiamento",
    "retomado",
  ],
} as const;

export const PALAVRAS_RODA = {
  // "nao" é checado antes de "sim", porque "nao da partida" contém "da partida"
  nao: [
    "nao da partida",
    "nao funciona",
    "nao liga",
    "sem motor",
    "motor travado",
    "motor fundido",
    "nao anda",
    "sem cambio",
  ],
  sim: [
    "funcionando",
    "motor funciona",
    "da partida",
    "em funcionamento",
    "rodando",
    "liga e anda",
    "funciona",
  ],
} as const;
