export type TipoVeiculo = "carro" | "moto";
export type CondicaoMonta =
  | "sem_monta"
  | "pequena"
  | "media"
  | "grande"
  | "sucata"
  | "nao_informado";
export type Roda = "sim" | "nao" | "nao_informado";
export type Decisao = "gostei" | "descartado";
export type SiteSlug = "vip" | "sodre" | "sold" | "freitas" | "loop";

/** Formato único que todo adaptador devolve. */
export interface LoteColetado {
  site: SiteSlug;
  idExterno: string;
  url: string;
  titulo: string;
  tipo?: TipoVeiculo;
  marca?: string;
  modelo?: string;
  versao?: string;
  descricao?: string;
  anoFab?: number;
  anoMod?: number;
  km?: number;
  uf?: string;
  cidade?: string;
  /** Texto bruto do site sobre monta/condição, se existir. */
  condicaoTexto?: string;
  combustivel?: string;
  lanceAtual?: number;
  lanceInicial?: number;
  avaliacao?: number;
  inicioEm?: string;
  fimEm?: string;
  status?: string;
  fotos: string[];
  raw: unknown;
}

export interface TermoBusca {
  id: string;
  termo: string;
  apelidos: string[];
  tipo: TipoVeiculo | null;
  anoMin: number | null;
  anoMax: number | null;
  lanceMax: number | null;
  ativo: boolean;
}
