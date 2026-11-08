"use server";

import { revalidatePath } from "next/cache";
import { normalizar } from "@karv/core";
import { supabaseServer } from "@/lib/supabase/server";

function numero(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/\./g, "").replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type Resultado = { erro?: string; ok?: boolean } | null;

export async function salvarTermo(_prev: Resultado, form: FormData): Promise<Resultado> {
  const id = String(form.get("id") ?? "") || null;
  const termo = normalizar(String(form.get("termo") ?? ""));
  if (!termo) return { erro: "Informe o modelo." };

  const apelidos = String(form.get("apelidos") ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  const tipoRaw = String(form.get("tipo") ?? "");
  const tipo = tipoRaw === "carro" || tipoRaw === "moto" ? tipoRaw : null;
  const ano_min = numero(form.get("ano_min"));
  const ano_max = numero(form.get("ano_max"));
  if (ano_min && ano_max && ano_min > ano_max) return { erro: "Ano mínimo maior que o máximo." };

  const linha = { termo, apelidos, tipo, ano_min, ano_max, lance_max: numero(form.get("lance_max")) };
  const supabase = await supabaseServer();
  const { error } = id
    ? await supabase.from("termos_busca").update(linha).eq("id", id)
    : await supabase.from("termos_busca").insert(linha);

  if (error) return { erro: error.code === "23505" ? `"${termo}" já existe.` : error.message };
  revalidatePath("/termos");
  return { ok: true };
}

export async function alternarTermo(id: string, ativo: boolean) {
  const supabase = await supabaseServer();
  await supabase.from("termos_busca").update({ ativo }).eq("id", id);
  revalidatePath("/termos");
}

export async function removerTermo(id: string) {
  const supabase = await supabaseServer();
  await supabase.from("termos_busca").delete().eq("id", id);
  revalidatePath("/termos");
}
