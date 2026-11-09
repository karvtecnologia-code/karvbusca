import { timingSafeEqual } from "node:crypto";
import { esc, Telegram, tecladoLote } from "@karv/core";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Update {
  message?: { chat: { id: number }; text?: string; from?: { first_name?: string } };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

function segredoOk(recebido: string | null) {
  const esperado = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!recebido || !esperado || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

export async function POST(req: Request) {
  // 1) só o Telegram conhece o secret_token cadastrado no setWebhook
  if (!segredoOk(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return new Response("unauthorized", { status: 401 });
  }
  const update = (await req.json()) as Update;
  const tg = new Telegram(process.env.TELEGRAM_BOT_TOKEN!);
  const db = supabaseAdmin();

  const { data: cfg } = await db.from("config").select("chat_id_telegram").single();
  const chatDono = cfg?.chat_id_telegram ? Number(cfg.chat_id_telegram) : null;
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  if (!chatId) return Response.json({ ok: true });

  // 2) primeira mensagem: captura o chat_id do dono
  if (!chatDono && update.message) {
    await db.from("config").update({ chat_id_telegram: chatId }).eq("id", true);
    await tg.enviarTexto(
      chatId,
      `✅ <b>KarvBusca conectado</b>, ${esc(update.message.from?.first_name ?? "")}.\nOs alertas de lotes novos vão chegar aqui.`,
    );
    return Response.json({ ok: true });
  }

  // 3) qualquer outro chat é ignorado em silêncio
  if (chatId !== chatDono) return Response.json({ ok: true });

  try {
    if (update.callback_query) await tratarBotao(update.callback_query, tg, db);
    else if (update.message?.text) await tratarComando(update.message.text, chatId, tg, db);
  } catch (e) {
    console.error("[telegram]", e);
  }
  // sempre 200: senão o Telegram reenvia a mesma atualização várias vezes
  return Response.json({ ok: true });
}

async function tratarBotao(
  cb: NonNullable<Update["callback_query"]>,
  tg: Telegram,
  db: ReturnType<typeof supabaseAdmin>,
) {
  const [acao, loteId] = (cb.data ?? "").split(":");
  const { data: lote } = await db.from("lotes").select("id, site_id, id_externo, url").eq("id", loteId).maybeSingle();
  if (!lote || !cb.message) {
    await tg.responderBotao(cb.id, "Lote não encontrado");
    return;
  }
  const chave = { site_id: lote.site_id, id_externo: lote.id_externo };

  if (acao === "g" || acao === "d") {
    const decisao = acao === "g" ? "gostei" : "descartado";
    await db.from("decisoes").upsert({ ...chave, decisao, decidido_em: new Date().toISOString() });
    await tg.trocarTeclado(cb.message.chat.id, cb.message.message_id, tecladoLote(lote.id, lote.url, decisao));
    await tg.responderBotao(cb.id, decisao === "gostei" ? "⭐ Adicionado aos favoritos" : "🗑 Descartado para sempre");
  } else if (acao === "u") {
    await db.from("decisoes").delete().match(chave);
    await tg.trocarTeclado(cb.message.chat.id, cb.message.message_id, tecladoLote(lote.id, lote.url));
    await tg.responderBotao(cb.id, "Desfeito");
  } else {
    await tg.responderBotao(cb.id);
  }
}

async function tratarComando(texto: string, chatId: number, tg: Telegram, db: ReturnType<typeof supabaseAdmin>) {
  const cmd = texto.trim().split(/\s+/)[0]!.toLowerCase().replace(/@.*$/, "");
  if (cmd === "/status") {
    const { data: sites } = await db.from("sites").select("nome, status, ultima_execucao, falhas_seguidas").order("id");
    const icone: Record<string, string> = { ok: "🟢", erro: "🔴", vazio: "🟠", nunca_rodou: "⚪" };
    const linhas = (sites ?? []).map((s) => {
      const h = s.ultima_execucao
        ? new Date(s.ultima_execucao).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
        : "nunca";
      return `${icone[s.status] ?? "⚪"} ${esc(s.nome)} · ${h}`;
    });
    await tg.enviarTexto(chatId, `<b>Saúde dos robôs</b>\n${linhas.join("\n")}`);
    return;
  }
  await tg.enviarTexto(
    chatId,
    "Comandos: /status (saúde dos robôs).\nEm breve: /favoritos, /hoje, /add &lt;modelo&gt;, /termos.",
  );
}
