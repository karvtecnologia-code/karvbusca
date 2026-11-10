import { UFS_ALVO } from "@karv/core";

/** Estados monitorados nesta execução (config.ufs no banco; padrão SP e MG). */
let ufs: string[] = [...UFS_ALVO];

export function definirUfs(lista: string[] | null | undefined) {
  if (lista?.length) ufs = lista.map((u) => u.toUpperCase());
}
export const ufsAtivas = () => ufs;
/** UF desconhecida passa (o detalhe completa); UF conhecida tem que estar na lista. */
export const ufOk = (uf?: string | null) => !uf || ufs.includes(uf);
