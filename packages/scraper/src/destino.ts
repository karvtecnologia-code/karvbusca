import type { SupabaseClient } from "@supabase/supabase-js";
import { Telegram, type Teclado } from "@karv/core";

/** Envia a mesma mensagem para todos os chats ligados (vários usuários). */
export class Destino {
  constructor(
    private tg: Telegram,
    public chats: number[],
  ) {}

  private async todos(f: (chat: number) => Promise<{ message_id: number }>) {
    let primeiro: { message_id: number } | null = null;
    for (const c of this.chats) {
      try {
        const m = await f(c);
        primeiro ??= m;
      } catch (e) {
        console.log(`[telegram] chat ${c}: ${(e as Error).message}`);
      }
    }
    if (!primeiro) throw new Error("nenhum chat recebeu a mensagem");
    return primeiro;
  }

  enviarFoto(foto: string | undefined, legenda: string, teclado?: Teclado) {
    return this.todos((c) => this.tg.enviarFoto(c, foto, legenda, teclado));
  }

  enviarTexto(texto: string, teclado?: Teclado) {
    return this.todos((c) => this.tg.enviarTexto(c, texto, teclado));
  }
}

let cache: Promise<Destino | null> | null = null;

/** Token: variável de ambiente (GitHub Secrets) ou o salvo no painel (Vault). Chats: tabela telegram_chats. */
export function destino(db: SupabaseClient): Promise<Destino | null> {
  cache ??= (async () => {
    let token = process.env.TELEGRAM_BOT_TOKEN?.replace(/^﻿/, "").trim();
    if (!token) token = ((await db.rpc("telegram_token")).data as string | null) ?? undefined;
    if (!token) return null;
    const { data } = await db.from("telegram_chats").select("chat_id");
    let chats = (data ?? []).map((c) => Number(c.chat_id));
    if (!chats.length) {
      const { data: cfg } = await db.from("config").select("chat_id_telegram").single();
      if (cfg?.chat_id_telegram) chats = [Number(cfg.chat_id_telegram)];
    }
    return chats.length ? new Destino(new Telegram(token), chats) : null;
  })();
  return cache;
}
