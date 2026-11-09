"use server";

import { revalidatePath } from "next/cache";
import { gerarAnalise, responderPergunta, type AnaliseIA } from "@/lib/ia";
import type { Config, LotePainel } from "@/lib/lotes";
import { supabaseServer } from "@/lib/supabase/server";

async function carregar(loteId: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const [{ data: lote }, { data: cfg }] = await Promise.all([
    supabase.from("lotes_painel").select("*").eq("id", loteId).single(),
    supabase.from("config").select("custo_doc_padrao, custo_patio_padrao, frete_padrao").single(),
  ]);
  if (!lote) throw new Error("Lote não encontrado.");
  return { supabase, lote: lote as LotePainel, padroes: cfg as Config };
}

export async function analisarLote(loteId: string): Promise<{ erro?: string }> {
  try {
    const { supabase, lote, padroes } = await carregar(loteId);
    const { analise, modelo } = await gerarAnalise(lote, padroes);
    await supabase.from("lote_ia").upsert({ lote_id: loteId, analise, modelo, gerado_em: new Date().toISOString() });
    revalidatePath(`/lote/${loteId}`);
    return {};
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

export async function perguntarIA(loteId: string, pergunta: string): Promise<{ erro?: string; resposta?: string }> {
  const p = pergunta.trim().slice(0, 1000);
  if (!p) return { erro: "Escreva uma pergunta." };
  try {
    const { supabase, lote, padroes } = await carregar(loteId);
    const [{ data: ia }, { data: hist }] = await Promise.all([
      supabase.from("lote_ia").select("analise").eq("lote_id", loteId).maybeSingle(),
      supabase.from("lote_ia_mensagens").select("papel, texto").eq("lote_id", loteId).order("criado_em"),
    ]);
    const resposta = await responderPergunta(
      lote,
      padroes,
      (ia?.analise as AnaliseIA) ?? null,
      (hist ?? []) as { papel: "user" | "assistant"; texto: string }[],
      p,
    );
    await supabase.from("lote_ia_mensagens").insert([
      { lote_id: loteId, papel: "user", texto: p },
      { lote_id: loteId, papel: "assistant", texto: resposta },
    ]);
    return { resposta };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

export async function limparConversa(loteId: string) {
  const supabase = await supabaseServer();
  await supabase.from("lote_ia_mensagens").delete().eq("lote_id", loteId);
  revalidatePath(`/lote/${loteId}`);
}
