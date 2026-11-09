/**
 * Palavras-chave de classificação. EDITE AQUI à vontade.
 * Tudo é comparado depois de normalizado (sem acento, minúsculo, palavra inteira).
 * A ordem de checagem fica em classify.ts: o mais grave vence.
 */
export const PALAVRAS_MONTA = {
  sucata: [
    "sucata",
    "baixa definitiva",
    "baixa permanente",
    "irrecuperavel",
    "para desmonte",
    "so pecas",
    "venda de pecas",
    "motor inservivel",
  ],
  grande: ["grande monta", "danos de grande", "dano de grande", "perda total"],
  media: ["media monta", "danos de media", "dano de media"],
  pequena: ["pequena monta", "danos de pequena", "dano de pequena"],
  sem_monta: [
    "sem monta",
    "sem sinistro",
    "sem registro de monta",
    "nao consta monta",
    "conservado",
    "recuperado de financiamento",
    "recuperado financiamento",
    "retomado",
  ],
} as const;

export const PALAVRAS_RODA = {
  // "nao" é checado antes de "sim", porque "nao da partida" contém "da partida"
  nao: [
    "nao da partida",
    "nao funciona",
    "nao liga",
    "nao ligando",
    "sem motor",
    "motor travado",
    "motor fundido",
    "motor nao funciona",
    "nao anda",
    "sem cambio",
    "funcionando na entrada nao",
    "motor inservivel",
  ],
  sim: [
    "funcionando",
    "motor funciona",
    "motor funcionando",
    "ligando motor funciona",
    "da partida",
    "em funcionamento",
    "rodando",
    "liga e anda",
    "funcionando na entrada sim",
  ],
} as const;

/** Circulação proibida até regularizar (vistoria CSV) ou para sempre. */
export const PALAVRAS_CIRCULACAO_VEDADA = [
  "circul vedada",
  "circulacao vedada",
  "circulacao proibida",
  "impedido de circular",
  "impedimento de circulacao",
  "proibido circular",
  "nao pode circular",
  "nao circula",
] as const;

/** O site afirma que o veículo pode circular. */
export const PALAVRAS_CIRCULACAO_LIBERADA = ["situacao em circulacao", "apto a circular", "documento ok para circular"] as const;

/** Danos que pesam na estrutura do carro. */
export const PALAVRAS_DANO_ESTRUTURAL = [
  "longarina",
  "coluna a",
  "coluna b",
  "coluna c",
  "chassi apresenta oxidacao",
  "corrosao acentuada",
  "assoalho danificado",
  "chassi danificado",
  "chassi remarcado",
  "chassi adulterado",
  "teto amassado",
  "danos estruturais",
  "dano estrutural",
  "long diant",
  "long tras",
  // problema mecânico grave (anda, mas não é carro para usar já)
  "motor batendo",
  "batendo valvulas",
  "batendo biela",
  "queimando oleo",
  "motor fundido",
  "cambio danificado",
  "cambio quebrado",
  "alagado",
  "submerso",
  "incendio",
  "queimado",
] as const;

export const PALAVRAS_PROCEDENCIA = {
  financiamento: ["recuperado de financiamento", "recuperado financiamento", "financeira"],
  seguradora: ["seguradora", "sinistro recuperado", "indenizado"],
  judicial: ["judicial", "penhorado", "tribunal", "justica"],
  apreensao: ["apreensao", "apreendido", "detran", "patio de transito", "removido"],
  frota: ["frota", "locadora", "renovacao de frota"],
  patrimonio: ["patrimonio", "orgao publico", "prefeitura"],
} as const;
