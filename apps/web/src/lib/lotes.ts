import { calcularLote, type PadroesCusto } from "@karv/core";

export interface LotePainel {
  id: string;
  site_id: number;
  site_slug: string;
  site_nome: string;
  comissao_pct: number;
  taxa_adm: number;
  id_externo: string;
  url: string;
  titulo: string;
  tipo: "carro" | "moto" | null;
  marca: string | null;
  modelo: string | null;
  versao: string | null;
  descricao: string | null;
  observacoes: string | null;
  ano_fab: number | null;
  ano_mod: number | null;
  km: number | null;
  uf: string | null;
  cidade: string | null;
  condicao_monta: string;
  roda: string;
  circulacao: string;
  chave: string;
  dano_estrutural: boolean;
  dano_detalhe: string[];
  procedencia: string;
  financiavel: boolean | null;
  ipva_pago: boolean | null;
  apto_rodar: boolean;
  combustivel: string | null;
  lance_atual: number | null;
  lance_inicial: number | null;
  fim_em: string | null;
  status: string | null;
  fotos: string[];
  fipe_codigo: string | null;
  fipe_valor: number | null;
  fipe_site: number | null;
  fipe_aproximada: boolean;
  taxas_site: number | null;
  custo_patio: number | null;
  custo_doc: number | null;
  custo_frete: number | null;
  visto_primeiro_em: string;
  decisao: "gostei" | "descartado" | null;
  nota: string | null;
  termos: string[];
}

export const CAMPOS_CARD =
  "id, site_id, site_slug, site_nome, comissao_pct, taxa_adm, id_externo, url, titulo, tipo, ano_fab, ano_mod, km, uf, cidade, condicao_monta, roda, circulacao, chave, dano_estrutural, apto_rodar, lance_atual, fim_em, status, fotos, fipe_valor, fipe_site, fipe_aproximada, taxas_site, custo_patio, custo_doc, custo_frete, visto_primeiro_em, decisao, nota, termos";

export type Config = PadroesCusto & {
  chat_id_telegram: number | null;
  origem: string;
};

export function valoresLote(l: Pick<LotePainel, "lance_atual" | "comissao_pct" | "taxa_adm" | "taxas_site" | "custo_patio" | "custo_doc" | "custo_frete" | "fipe_valor" | "fipe_site">, cfg: PadroesCusto) {
  return calcularLote(l, cfg);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const reais = (v: number | null | undefined) => (v == null ? "—" : brl.format(v));
export const kmFmt = (v: number | null | undefined) => (v == null ? null : `${v.toLocaleString("pt-BR")} km`);
export const anosFmt = (f: number | null, m: number | null) => (f || m ? `${f ?? "?"}/${m ?? "?"}` : null);

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
export const quando = (iso: string | null | undefined) => (iso ? dataHora.format(new Date(iso)) : "—");

export type Tom = "ok" | "warn" | "bad" | "neutro";
export const MONTA: Record<string, { rotulo: string; tom: Tom }> = {
  sem_monta: { rotulo: "Sem monta", tom: "ok" },
  pequena: { rotulo: "Pequena monta", tom: "warn" },
  media: { rotulo: "Média monta", tom: "warn" },
  grande: { rotulo: "Grande monta", tom: "bad" },
  sucata: { rotulo: "Sucata", tom: "bad" },
  nao_informado: { rotulo: "Monta ?", tom: "neutro" },
};
export const RODA: Record<string, { rotulo: string; tom: Tom }> = {
  sim: { rotulo: "Motor funciona", tom: "ok" },
  nao: { rotulo: "Motor não funciona", tom: "bad" },
  nao_informado: { rotulo: "Motor ?", tom: "neutro" },
};
export const PROCEDENCIA: Record<string, string> = {
  financiamento: "Financeira",
  seguradora: "Seguradora",
  patrimonio: "Patrimônio",
  judicial: "Judicial",
  apreensao: "Apreensão",
  frota: "Frota",
  particular: "Particular",
  nao_informado: "Não informada",
};
