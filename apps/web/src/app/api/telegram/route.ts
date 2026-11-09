import { timingSafeEqual } from "node:crypto";
import { esc, normalizar, reais, Telegram, tecladoLote } from "@karv/core";
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
  if (cmd === "/favoritos") {
    const { data } = await db
      .from("lotes_painel")
      .select("titulo, lance_atual, fim_em, url, site_nome")
      .eq("decisao", "gostei")
      .gt("fim_em", new Date().toISOString())
      .order("fim_em")
      .limit(15);
    if (!data?.length) return void (await tg.enviarTexto(chatId, "Nenhum favorito aberto. Toque em 👍 num alerta."));
    await tg.enviarTexto(chatId, `<b>⭐ Favoritos (${data.length})</b>\n\n${data.map(linhaLote).join("\n\n")}`);
    return;
  }

  if (cmd === "/hoje") {
    // "hoje" no horário de Brasília: até 23:59 de hoje
    const fimDoDia = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }).replace(/,.*/, "") + " 23:59:59 GMT-0300",
    );
    const { data } = await db
      .from("lotes_painel")
      .select("titulo, lance_atual, fim_em, url, site_nome, decisao, apto_rodar")
      .or("decisao.is.null,decisao.eq.gostei")
      .or("apto_rodar.eq.true,decisao.eq.gostei")
      .in("uf", ["SP", "MG"])
      .gt("fim_em", new Date().toISOString())
      .lte("fim_em", fimDoDia.toISOString())
      .order("fim_em")
      .limit(20);
    if (!data?.length) return void (await tg.enviarTexto(chatId, "Nenhum lote apto ou favorito encerra hoje."));
    await tg.enviarTexto(
      chatId,
      `<b>📅 Encerram hoje (${data.length})</b>\n\n${data
        .map((l) => (l.decisao === "gostei" ? "⭐ " : "") + linhaLote(l))
        .join("\n\n")}`,
    );
    return;
  }

  if (cmd === "/termos") {
    const { data } = await db.from("termos_busca").select("termo, apelidos, tipo, ativo").order("termo");
    const linhas = (data ?? []).map(
      (t) =>
        `${t.ativo ? "🟢" : "⚪"} <b>${esc(t.termo)}</b>${t.tipo ? ` · ${t.tipo}` : ""}${
          t.apelidos?.length ? ` <i>(${esc(t.apelidos.join(", "))})</i>` : ""
        }`,
    );
    await tg.enviarTexto(chatId, `<b>Termos de busca</b>\n${linhas.join("\n")}\n\nAdicione com /add modelo`);
    return;
  }

  if (cmd === "/add") {
    const resto = texto.trim().split(/\s+/).slice(1).join(" ");
    const termo = normalizar(resto);
    if (!termo) return void (await tg.enviarTexto(chatId, "Use assim: /add civic"));
    const { error } = await db.from("termos_busca").insert({ termo });
    await tg.enviarTexto(
      chatId,
      error?.code === "23505"
        ? `"${esc(termo)}" já está cadastrado.`
        : error
          ? `Erro: ${esc(error.message)}`
          : `✅ <b>${esc(termo)}</b> adicionado. Entra na próxima busca (07h, 12h ou 18h).\nAjuste ano, tipo e lance máximo no painel.`,
    );
    return;
  }

  await tg.enviarTexto(
    chatId,
    [
      "<b>Comandos</b>",
      "/favoritos — favoritos abertos, pelo encerramento",
      "/hoje — aptos e favoritos que encerram hoje",
      "/termos — modelos monitorados",
      "/add &lt;modelo&gt; — monitorar um modelo novo",
      "/status — saúde dos robôs",
    ].join("\n"),
  );
}

function linhaLote(l: { titulo: string; lance_atual: number | null; fim_em: string | null; url: string; site_nome: string }) {
  const fim = l.fim_em
    ? new Date(l.fim_em).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  return `<a href="${esc(l.url)}">${esc(l.titulo)}</a>\n${reais(l.lance_atual)} · ${esc(fim)} · <i>${esc(l.site_nome)}</i>`;
}
