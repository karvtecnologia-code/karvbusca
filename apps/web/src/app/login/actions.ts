"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function entrar(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  if (!email || !senha) return "Preencha e-mail e senha.";

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return "E-mail ou senha incorretos.";
  redirect("/");
}

export async function sair() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
