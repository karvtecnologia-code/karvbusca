import { UFS_ALVO } from "@karv/core";

/**
 * Estados "preferidos" (config.ufs; padrão SP e MG).
 * A COLETA traz todos os estados (o painel filtra); os preferidos valem para os alertas
 * do Telegram, para o modo descoberta e para a visão padrão do painel.
 */
let ufs: string[] = [...UFS_ALVO];

export function definirUfs(lista: string[] | null | undefined) {
  if (lista?.length) ufs = lista.map((u) => u.toUpperCase());
}
export const ufsAtivas = () => ufs;
/** Coleta: aceita qualquer estado. */
export const ufOk = (_uf?: string | null) => true;
/** Alerta/descoberta: só estados preferidos (UF desconhecida passa; o detalhe completa). */
export const ufPreferida = (uf?: string | null) => !uf || ufs.includes(uf);
