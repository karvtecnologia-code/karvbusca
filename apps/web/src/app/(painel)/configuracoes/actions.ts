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

type Res = { ok?: boolean | string; erro?: string } | null;

export async function salvarOportunidades(_: unknown, form: FormData): Promise<Res> {
  const pct = n(form.get("pct"));
  const ano = n(form.get("ano"));
  const quente = n(form.get("quente"));
  const ia = n(form.get("ia"));
  if (pct == null || pct < 20 || pct > 95) return { erro: "% da FIPE entre 20 e 95." };
  if (ia == null || ia < 0 || ia > 50) return { erro: "Análises automáticas por dia: de 0 a 50." };
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("config")
    .update({
      descoberta_ativa: form.get("descoberta") === "on",
      descoberta_pct_fipe: pct / 100,
      descoberta_ano_min: ano ?? 2012,
      nota_alerta_quente: quente ?? 75,
      ia_auto_max_dia: ia,
      frete_por_km: n(form.get("porkm")),
    })
    .eq("id", true);
  revalidatePath("/", "layout");
  return error ? { erro: error.message } : { ok: true };
}

/** Provedor, modelo e (opcional) nova chave da IA. A chave vai para o Vault. */
export async function salvarIA(_: unknown, form: FormData): Promise<Res> {
  const supabase = await supabaseServer();
  const base = String(form.get("base") ?? "").trim();
  const modelo = String(form.get("modelo") ?? "").trim();
  const chave = String(form.get("chave") ?? "").trim();
  if (!/^https?:\/\//.test(base) || !modelo) return { erro: "Informe o endereço e o modelo." };
  const { error } = await supabase.from("config").update({ ia_base_url: base, ia_modelo: modelo }).eq("id", true);
  if (error) return { erro: error.message };
  if (chave) {
    const { error: e2 } = await supabase.rpc("ia_salvar_chave", { p_chave: chave });
    if (e2) return { erro: e2.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Testa a IA com uma pergunta curta. */
export async function testarIA(): Promise<Res> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada." };
  const db = supabaseAdmin();
  const [{ data: cfg }, { data: chave }] = await Promise.all([
    db.from("config").select("ia_base_url, ia_modelo").single(),
    db.rpc("ia_chave"),
  ]);
  if (!chave) return { erro: "Nenhuma chave cadastrada." };
  const r = await fetch(`${String(cfg!.ia_base_url).replace(/\/?$/, "/")}chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
    body: JSON.stringify({ model: cfg!.ia_modelo, messages: [{ role: "user", content: "Responda só: ok" }] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) return { erro: `A IA respondeu ${r.status}: ${(await r.text()).slice(0, 160)}` };
  return { ok: "IA respondendo ✓" };
}

export async function salvarCredencial(_: unknown, form: FormData): Promise<Res> {
  const supabase = await supabaseServer();
  const nome = String(form.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome." };
  const { error } = await supabase.rpc("cofre_salvar", {
    p_id: String(form.get("id") ?? "") || null,
    p_nome: nome,
    p_site: String(form.get("site") ?? ""),
    p_usuario: String(form.get("usuario") ?? "").trim(),
    p_senha: String(form.get("senha") ?? ""),
    p_obs: String(form.get("obs") ?? "").trim(),
  });
  if (error) return { erro: error.message };
  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function revelarSenha(id: string): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("cofre_revelar", { p_id: id });
  return (data as string) ?? null;
}

export async function removerCredencial(id: string) {
  const supabase = await supabaseServer();
  await supabase.rpc("cofre_remover", { p_id: id });
  revalidatePath("/configuracoes");
}

/** Troca a senha do painel (confere a senha atual antes). */
export async function trocarSenha(_: unknown, form: FormData): Promise<Res> {
  const atual = String(form.get("atual") ?? "");
  const nova = String(form.get("nova") ?? "");
  const conf = String(form.get("confirma") ?? "");
  if (nova.length < 8) return { erro: "A nova senha precisa ter pelo menos 8 caracteres." };
  if (nova !== conf) return { erro: "A confirmação não bate com a nova senha." };
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada." };
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: user.email, password: atual });
  if (e1) return { erro: "Senha atual incorreta." };
  const { error } = await supabase.auth.updateUser({ password: nova });
  return error ? { erro: error.message } : { ok: "Senha alterada ✓" };
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
