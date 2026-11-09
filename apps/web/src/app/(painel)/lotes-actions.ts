"use server";

import { revalidatePath } from "next/cache";
import { Fipe } from "@karv/core";
import { supabaseServer } from "@/lib/supabase/server";

async function chaveDoLote(loteId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("lotes").select("site_id, id_externo").eq("id", loteId).single();
  if (!data) throw new Error("Lote não encontrado");
  return { supabase, chave: data };
}

/** Gostei / Descartar / desfazer (null). */
export async function decidir(loteId: string, decisao: "gostei" | "descartado" | null) {
  const { supabase, chave } = await chaveDoLote(loteId);
  if (decisao) {
    await supabase.from("decisoes").upsert({ ...chave, decisao, decidido_em: new Date().toISOString() });
  } else {
    await supabase.from("decisoes").delete().match(chave);
  }
  revalidatePath("/", "layout");
}

export async function salvarNota(loteId: string, nota: string) {
  const { supabase, chave } = await chaveDoLote(loteId);
  await supabase
    .from("decisoes")
    .update({ nota: nota.trim() || null })
    .match(chave);
  revalidatePath("/favoritos");
}

const n = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/\./g, "").replace(",", ".").trim();
  return s === "" ? null : Number(s);
};

/** Custos editados para um lote específico (vazio = volta ao padrão). */
export async function salvarCustos(loteId: string, form: FormData) {
  const supabase = await supabaseServer();
  await supabase
    .from("lotes")
    .update({ custo_patio: n(form.get("patio")), custo_doc: n(form.get("doc")), custo_frete: n(form.get("frete")) })
    .eq("id", loteId);
  revalidatePath(`/lote/${loteId}`);
}

/** Correção manual do código FIPE. */
export async function corrigirFipe(loteId: string, form: FormData): Promise<{ erro?: string; ok?: string }> {
  const codigo = String(form.get("codigo") ?? "").trim();
  if (!/^\d{6}-\d$/.test(codigo)) return { erro: "Código no formato 000000-0" };
  const supabase = await supabaseServer();
  const { data: l } = await supabase.from("lotes").select("ano_mod, ano_fab, tipo, combustivel").eq("id", loteId).single();
  const ano = l?.ano_mod ?? l?.ano_fab;
  if (!ano) return { erro: "Lote sem ano: não dá para consultar a FIPE" };
  const r = await new Fipe().porCodigo(codigo, ano, l?.tipo === "moto", l?.combustivel ?? undefined).catch(() => null);
  if (!r) return { erro: `Sem valor FIPE para ${codigo} em ${ano}` };
  await supabase
    .from("lotes")
    .update({ fipe_codigo: r.codigo, fipe_valor: r.valor, fipe_aproximada: false, fipe_atualizado_em: new Date().toISOString() })
    .eq("id", loteId);
  revalidatePath(`/lote/${loteId}`);
  return { ok: `${r.modelo} · ${r.ano}` };
}
