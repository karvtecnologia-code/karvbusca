"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Telegram } from "@karv/core";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { tokenBot } from "@/lib/telegram";
import { UFS_BR } from "@/lib/lotes";

type Res = { ok?: boolean | string; erro?: string } | null;

async function logado() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  return { supabase, user };
}

// ---------------------------------------------------------------- Telegram

export async function salvarTokenBot(_: unknown, form: FormData): Promise<Res> {
  const token = String(form.get("token") ?? "").trim();
  if (!/^\d{6,}:[\w-]{30,}$/.test(token)) return { erro: "Token inválido. Ele tem o formato 123456789:AAH…" };
  const { supabase } = await logado();
  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());
  if (!me.ok) return { erro: "O Telegram recusou este token. Copie de novo do @BotFather." };
  const { error } = await supabase.rpc("telegram_salvar_token", { p_token: token });
  if (error) return { erro: error.message };
  revalidatePath("/configuracoes");
  return { ok: `Bot @${me.result.username} salvo. Agora clique em “Conectar bot”.` };
}

/** Registra o webhook (com um secret novo) e o menu de comandos do bot. */
export async function conectarBot(): Promise<Res> {
  await logado();
  const token = await tokenBot();
  if (!token) return { erro: "Salve o token do bot primeiro." };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || /localhost|127\.0\.0\.1/.test(host))
    return { erro: "Conecte pelo site publicado (ex.: seu-projeto.vercel.app), não pelo localhost." };
  const segredo = randomBytes(24).toString("hex");
  const db = supabaseAdmin();
  const { error } = await db.rpc("telegram_salvar_webhook_secret", { p_secret: segredo });
  if (error) return { erro: error.message };
  const tg = new Telegram(token);
  try {
    await tg.chamar("setWebhook", {
      url: `https://${host}/api/telegram`,
      secret_token: segredo,
      allowed_updates: ["message", "callback_query"],
    });
    await tg.chamar("setMyCommands", {
      commands: [
        { command: "favoritos", description: "Favoritos abertos, pelo encerramento" },
        { command: "hoje", description: "Aptos e favoritos que encerram hoje" },
        { command: "termos", description: "Modelos monitorados" },
        { command: "add", description: "Monitorar um modelo novo, ex.: /add civic" },
        { command: "status", description: "Saúde dos robôs" },
      ],
    });
  } catch (e) {
    return { erro: (e as Error).message };
  }
  return { ok: `Bot conectado a https://${host}/api/telegram ✓` };
}

export async function novoCodigoVinculo() {
  const { supabase } = await logado();
  await supabase.from("config").update({ codigo_vinculo: randomBytes(3).toString("hex") }).eq("id", true);
  revalidatePath("/configuracoes");
}

export async function desligarChat(chatId: number) {
  const { supabase } = await logado();
  await supabase.from("telegram_chats").delete().eq("chat_id", chatId);
  revalidatePath("/configuracoes");
}

// ---------------------------------------------------------------- estados e origem

export async function salvarEstados(_: unknown, form: FormData): Promise<Res> {
  const ufs = form.getAll("uf").map(String).filter((u) => UFS_BR.includes(u));
  if (!ufs.length) return { erro: "Escolha pelo menos um estado." };
  const { supabase } = await logado();
  const { error } = await supabase.from("config").update({ ufs }).eq("id", true);
  revalidatePath("/", "layout");
  return error ? { erro: error.message } : { ok: `${ufs.length} estado(s). Vale a partir da próxima busca.` };
}

/** Cidade de origem: localiza (Nominatim) e zera as distâncias para o robô recalcular. */
export async function salvarOrigem(_: unknown, form: FormData): Promise<Res> {
  const cidade = String(form.get("cidade") ?? "").trim();
  const uf = String(form.get("uf") ?? "").trim().toUpperCase();
  if (!cidade || !UFS_BR.includes(uf)) return { erro: "Informe a cidade e o estado." };
  await logado();
  const p = new URLSearchParams({ city: cidade, state: uf, country: "Brazil", format: "json", limit: "1" });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
    headers: { "user-agent": "KarvBusca/1.0 (monitor pessoal de leiloes)" },
  });
  const [hit] = (r.ok ? await r.json() : []) as { lat: string; lon: string }[];
  if (!hit) return { erro: `Não achei ${cidade}-${uf} no mapa. Confira o nome.` };
  const db = supabaseAdmin();
  await db
    .from("config")
    .update({ origem: `${cidade}-${uf}`, origem_lat: Number(hit.lat), origem_lon: Number(hit.lon) })
    .eq("id", true);
  // distâncias antigas eram até a origem anterior
  await db.from("cidades_geo").delete().not("chave", "is", null);
  await db.from("lotes").update({ distancia_km: null }).not("distancia_km", "is", null);
  revalidatePath("/", "layout");
  return { ok: `Origem: ${cidade}-${uf}. As distâncias são recalculadas na próxima busca.` };
}

// ---------------------------------------------------------------- usuários

export async function listarUsuarios() {
  await logado();
  const { data } = await supabaseAdmin().auth.admin.listUsers({ perPage: 100 });
  return (data?.users ?? []).map((u) => ({ id: u.id, email: u.email ?? "", criado: u.created_at, ultimo: u.last_sign_in_at ?? null }));
}

export async function criarUsuario(_: unknown, form: FormData): Promise<Res> {
  await logado();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { erro: "E-mail inválido." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  const { error } = await supabaseAdmin().auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) return { erro: /already/i.test(error.message) ? "Esse e-mail já tem acesso." : error.message };
  revalidatePath("/configuracoes");
  return { ok: `Acesso criado para ${email}.` };
}

export async function removerUsuario(id: string): Promise<Res> {
  const { user } = await logado();
  if (id === user.id) return { erro: "Você não pode remover a si mesmo." };
  const { error } = await supabaseAdmin().auth.admin.deleteUser(id);
  revalidatePath("/configuracoes");
  return error ? { erro: error.message } : { ok: true };
}
