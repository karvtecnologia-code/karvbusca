import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TermoBusca } from "@karv/core";

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function carregarTermos(db: SupabaseClient): Promise<TermoBusca[]> {
  const { data, error } = await db
    .from("termos_busca")
    .select("id, termo, apelidos, tipo, ano_min, ano_max, lance_max, ativo")
    .eq("ativo", true);
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    termo: t.termo,
    apelidos: t.apelidos ?? [],
    tipo: t.tipo,
    anoMin: t.ano_min,
    anoMax: t.ano_max,
    lanceMax: t.lance_max,
    ativo: t.ativo,
  }));
}

export interface SiteRow {
  id: number;
  slug: string;
  nome: string;
  ativo: boolean;
  falhas_seguidas: number;
}

export async function carregarSites(db: SupabaseClient): Promise<SiteRow[]> {
  const { data, error } = await db.from("sites").select("id, slug, nome, ativo, falhas_seguidas").order("id");
  if (error) throw error;
  return data ?? [];
}
