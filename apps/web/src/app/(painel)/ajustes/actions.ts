"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const n = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/\./g, "").replace(",", ".").trim();
  return s === "" ? null : Number(s);
};

export async function salvarPadroes(_: unknown, form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("config")
    .update({
      custo_doc_padrao: n(form.get("doc")) ?? 0,
      custo_patio_padrao: n(form.get("patio")) ?? 0,
      frete_padrao: n(form.get("frete")),
    })
    .eq("id", true);
  revalidatePath("/", "layout");
  return error ? { erro: error.message } : { ok: true };
}

export async function salvarSite(_: unknown, form: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("sites")
    .update({
      comissao_pct: n(form.get("comissao")) ?? 5,
      taxa_adm: n(form.get("taxa")) ?? 0,
      ativo: form.get("ativo") === "on",
    })
    .eq("id", Number(form.get("id")));
  revalidatePath("/", "layout");
  return error ? { erro: error.message } : { ok: true };
}
