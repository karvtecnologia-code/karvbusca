/** Cliente mínimo da Telegram Bot API (só fetch, sem dependências). */

export interface Botao {
  text: string;
  callback_data?: string;
  url?: string;
}
export type Teclado = Botao[][];

export class Telegram {
  constructor(private token: string) {}

  async chamar<T = unknown>(metodo: string, corpo: Record<string, unknown>): Promise<T> {
    const r = await fetch(`https://api.telegram.org/bot${this.token}/${metodo}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = (await r.json()) as { ok: boolean; result: T; description?: string };
    if (!j.ok) throw new Error(`Telegram ${metodo}: ${j.description ?? r.status}`);
    return j.result;
  }

  enviarTexto(chatId: number, texto: string, teclado?: Teclado) {
    return this.chamar<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text: texto,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(teclado ? { reply_markup: { inline_keyboard: teclado } } : {}),
    });
  }

  /** Foto com legenda; se a foto falhar (link quebrado), manda só o texto. */
  async enviarFoto(chatId: number, foto: string | undefined, legenda: string, teclado?: Teclado) {
    if (foto) {
      try {
        return await this.chamar<{ message_id: number }>("sendPhoto", {
          chat_id: chatId,
          photo: foto,
          caption: legenda,
          parse_mode: "HTML",
          ...(teclado ? { reply_markup: { inline_keyboard: teclado } } : {}),
        });
      } catch {
        /* cai para texto */
      }
    }
    return this.enviarTexto(chatId, legenda, teclado);
  }

  responderBotao(callbackId: string, texto?: string) {
    return this.chamar("answerCallbackQuery", { callback_query_id: callbackId, text: texto });
  }

  trocarTeclado(chatId: number, messageId: number, teclado: Teclado) {
    return this.chamar("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: teclado },
    });
  }
}

/** Escapa texto para parse_mode HTML. */
export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const reais = (v: number | null | undefined) => (v == null ? "—" : brl.format(v));

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
export const quando = (iso: string | null | undefined) => (iso ? dataHora.format(new Date(iso)) : "—");

export const ROTULO_MONTA: Record<string, string> = {
  sem_monta: "✅ sem monta",
  pequena: "🟡 pequena monta",
  media: "🟠 média monta",
  grande: "🔴 grande monta",
  sucata: "⛔ sucata",
  nao_informado: "❔ monta não informada",
};
export const ROTULO_RODA: Record<string, string> = {
  sim: "🟢 motor funciona",
  nao: "🔴 motor não funciona",
  nao_informado: "❔ motor não informado",
};

/** Botões do alerta. callback_data: "g:<lote_id>" (gostei) ou "d:<lote_id>" (descartar). */
export function tecladoLote(loteId: string, url: string, decisao?: "gostei" | "descartado"): Teclado {
  if (decisao === "gostei")
    return [[{ text: "⭐ Favorito", callback_data: `d:${loteId}` }, { text: "🔗 Ver no site", url }]];
  if (decisao === "descartado")
    return [[{ text: "Descartado · desfazer", callback_data: `u:${loteId}` }]];
  return [
    [
      { text: "👍 Gostei", callback_data: `g:${loteId}` },
      { text: "🗑 Descartar", callback_data: `d:${loteId}` },
    ],
    [{ text: "🔗 Ver no site", url }],
  ];
}
