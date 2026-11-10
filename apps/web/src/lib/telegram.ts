import "server-only";
import { Telegram } from "@karv/core";
import { supabaseAdmin } from "./supabase/admin";

/** Token do bot: variável de ambiente (opcional) ou o salvo em Configurações (Vault). */
export async function tokenBot(): Promise<string | null> {
  const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (env) return env;
  const { data } = await supabaseAdmin().rpc("telegram_token");
  return (data as string | null) ?? null;
}

export async function segredoWebhook(): Promise<string | null> {
  const env = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (env) return env;
  const { data } = await supabaseAdmin().rpc("telegram_webhook_secret");
  return (data as string | null) ?? null;
}

export async function bot(): Promise<Telegram | null> {
  const t = await tokenBot();
  return t ? new Telegram(t) : null;
}

/** Chats ligados (recebem alertas e podem usar os botões e comandos). */
export async function chatsLigados(): Promise<number[]> {
  const { data } = await supabaseAdmin().from("telegram_chats").select("chat_id");
  return (data ?? []).map((c) => Number(c.chat_id));
}
