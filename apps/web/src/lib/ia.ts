import "server-only";
import {
  analisarLoteIA,
  completarIA,
  fotosParaIA,
  SISTEMA_IA,
  type AnaliseIA,
  type ConfigIA,
  type MensagemIA,
} from "@karv/core";
import { supabaseAdmin } from "./supabase/admin";
import { anosFmt, kmFmt, MONTA, PROCEDENCIA, quando, reais, RODA, valoresLote, type LotePainel } from "./lotes";

export type { AnaliseIA };

async function configIA(): Promise<ConfigIA> {
  const db = supabaseAdmin();
  const [{ data: cfg }, { data: chave }] = await Promise.all([
    db.from("config").select("ia_base_url, ia_modelo").single(),
    db.rpc("ia_chave"),
  ]);
  if (!chave) throw new Error("Cadastre a chave da IA em Configurações.");
  return { base: String(cfg!.ia_base_url), modelo: cfg!.ia_modelo as string, chave: chave as string };
}

/** Ficha do lote em texto, usada como contexto da análise e da conversa. */
export function fichaLote(l: LotePainel, padroes: Parameters<typeof valoresLote>[1]) {
  const v = valoresLote(l, padroes);
  return [
    `Veículo: ${l.titulo}`,
    `Site: ${l.site_nome} | Link: ${l.url}`,
    `Ano: ${anosFmt(l.ano_fab, l.ano_mod) ?? "?"} | Km: ${kmFmt(l.km) ?? "não informado"} | Combustível: ${l.combustivel ?? "?"}`,
    `Local: ${[l.cidade, l.uf].filter(Boolean).join("-") || "?"}${l.distancia_km != null ? ` (${l.distancia_km} km da cidade do comprador)` : ""}`,
    `Classificação do sistema: ${MONTA[l.condicao_monta]?.rotulo} | ${RODA[l.roda]?.rotulo} | circulação: ${l.circulacao} | chave: ${l.chave} | procedência: ${PROCEDENCIA[l.procedencia]}`,
    l.dano_detalhe.length ? `Danos detectados no texto: ${l.dano_detalhe.join(", ")}` : null,
    `Lance atual: ${reais(l.lance_atual)} | Lance inicial: ${reais(l.lance_inicial)} | Encerra: ${quando(l.fim_em)}`,
    `Custo real estimado: ${reais(v.custo)} (comissão ${l.comissao_pct}%, taxas ${reais(v.taxaAdm)}, pátio ${reais(v.patio)}, documentação ${reais(v.doc)}, frete ${reais(v.frete)})`,
    `FIPE: ${reais(v.fipe)}${l.fipe_aproximada ? " (aproximada)" : ""} | Custo real / FIPE: ${v.pct != null ? Math.round(v.pct * 100) + "%" : "?"}`,
    l.financiavel != null ? `Financiável: ${l.financiavel ? "sim" : "não"}` : null,
    l.ipva_pago != null ? `IPVA pago: ${l.ipva_pago ? "sim" : "não"}` : null,
    `\nTexto original do site:\n${(l.observacoes ?? l.descricao ?? "(sem descrição)").slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function gerarAnalise(l: LotePainel, padroes: Parameters<typeof valoresLote>[1]) {
  const cfg = await configIA();
  return analisarLoteIA(cfg, fichaLote(l, padroes), await fotosParaIA(l.fotos));
}

export async function responderPergunta(
  l: LotePainel,
  padroes: Parameters<typeof valoresLote>[1],
  analise: AnaliseIA | null,
  historico: { papel: "user" | "assistant"; texto: string }[],
  pergunta: string,
) {
  const contexto = `${fichaLote(l, padroes)}${analise ? `\n\nSua análise anterior: ${JSON.stringify(analise)}` : ""}`;
  const { texto } = await completarIA(
    await configIA(),
    [
      { role: "system", content: `${SISTEMA_IA}\n\nResponda perguntas sobre ESTE lote, em até 6 frases.\n\n${contexto}` },
      ...historico.slice(-10).map((m) => ({ role: m.papel, content: m.texto }) as MensagemIA),
      { role: "user", content: pergunta },
    ],
    false,
  );
  return texto.trim();
}
