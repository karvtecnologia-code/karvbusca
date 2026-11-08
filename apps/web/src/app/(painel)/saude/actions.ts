"use server";

import { supabaseServer } from "@/lib/supabase/server";

export type Disparo = { ok?: boolean; erro?: string } | null;

/** Dispara o workflow "Busca completa" no GitHub Actions (botão "rodar agora"). */
export async function rodarAgora(_prev: Disparo, form: FormData): Promise<Disparo> {
  // só quem está logado chega aqui (o proxy bloqueia o resto), mas conferimos de novo
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada." };

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return { erro: "Falta GITHUB_DISPATCH_TOKEN ou GITHUB_REPO nas variáveis da Vercel." };

  const site = String(form.get("site") ?? "");
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/scrape-full.yml/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main", inputs: { sites: site } }),
  });
  if (r.status !== 204) return { erro: `GitHub respondeu ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}
