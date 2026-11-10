import {
  aptoRodar,
  classificarCirculacao,
  classificarMonta,
  classificarProcedencia,
  classificarRoda,
  danosEstruturais,
  type LoteColetado,
} from "@karv/core";

/** Monta a linha da tabela `lotes` a partir do lote coletado. */
export function classificar(l: LoteColetado) {
  // condição: campos estruturados do site primeiro, depois título e observações
  const textos = [l.condicaoTexto, l.titulo, l.observacoes];
  const monta = classificarMonta(...textos);
  const roda = classificarRoda(l.condicaoTexto, l.observacoes);
  const circulacao = classificarCirculacao(l.condicaoTexto, l.observacoes);
  const danos = danosEstruturais(l.observacoes, l.condicaoTexto);
  const procedencia = classificarProcedencia(l.procedenciaTexto, l.condicaoTexto);
  return {
    titulo: l.titulo,
    url: l.url,
    tipo: l.tipo ?? null,
    marca: l.marca ?? null,
    modelo: l.modelo ?? null,
    versao: l.versao ?? null,
    descricao: l.descricao ?? null,
    ano_fab: l.anoFab ?? null,
    ano_mod: l.anoMod ?? null,
    km: l.km ?? null,
    uf: l.uf ?? null,
    cidade: l.cidade ?? null,
    condicao_monta: monta,
    roda,
    circulacao,
    chave: l.chave ?? "nao_informado",
    dano_estrutural: danos.length > 0,
    dano_detalhe: danos,
    procedencia,
    financiavel: l.financiavel ?? null,
    ipva_pago: l.ipvaPago ?? null,
    fipe_site: l.fipeSite ?? null,
    taxas_site: l.taxasSite ?? null,
    observacoes: l.observacoes ?? null,
    apto_rodar: aptoRodar({ monta, roda, circulacao, danoEstrutural: danos.length > 0 }),
    combustivel: l.combustivel ?? null,
    lance_atual: l.lanceAtual ?? null,
    lance_inicial: l.lanceInicial ?? null,
    avaliacao: l.avaliacao ?? null,
    inicio_em: l.inicioEm ?? null,
    fim_em: l.fimEm ?? null,
    status: l.status ?? null,
    raw: l.raw as object,
  };
}

export type LinhaLote = ReturnType<typeof classificar>;

/**
 * Regra do alerta de lote novo: todo lote apto a rodar (o mesmo que aparece na aba Lotes),
 * com o motor não marcado como parado. A monta vai como selo na mensagem.
 * Estoque sem leilão marcado ("Em breve") não gera alerta: só quando entrar em leilão.
 */
export function mereceAlertaNovo(
  l: Pick<LinhaLote, "apto_rodar" | "condicao_monta" | "roda" | "circulacao" | "status">,
): boolean {
  // todo lote que aparece na aba Lotes (apto a rodar) é avisado; o selo de monta vai na mensagem
  void l.circulacao;
  return l.apto_rodar && l.roda !== "nao" && l.status !== "estoque";
}
