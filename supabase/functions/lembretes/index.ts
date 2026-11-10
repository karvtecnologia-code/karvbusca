// Edge Function "lembretes": chamada pelo pg_cron a cada 15 min.
// Manda no Telegram os lembretes de 24h e 2h antes do encerramento dos favoritos.
// Idempotente: cada lembrete sai uma vez por lote (alertas_enviados), e a resposta
// só traz contagens. Por isso roda sem JWT (--no-verify-jwt) e sem segredo no SQL.
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const hora = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function telegram(metodo: string, corpo: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description);
  return j.result as { message_id: number };
}

interface Fav {
  id: string;
  site_id: number;
  titulo: string;
  url: string;
  lance_atual: number | null;
  fim_em: string;
  fotos: string[];
  site_nome: string;
  nota_pessoal: string | null;
}

const JANELAS = [
  { tipo: "lembrete_24h", horas: 24, titulo: "⏰ <b>Encerra em 24h</b>", foto: true },
  { tipo: "lembrete_2h", horas: 2, titulo: "🚨 <b>Encerra em 2h</b>", foto: false },
] as const;

Deno.serve(async () => {
  const { data: cfg } = await db.from("config").select("chat_id_telegram").single();
  const chat = cfg?.chat_id_telegram;
  if (!chat || !TOKEN) return Response.json({ ok: true, enviados: 0, motivo: "sem chat/token" });

  const agora = Date.now();
  const resultado: Record<string, number> = {};

  for (const j of JANELAS) {
    // favoritos que encerram dentro da janela e ainda não receberam este lembrete
    const { data: favs } = await db
      .from("lotes_painel")
      .select("id, site_id, titulo, url, lance_atual, fim_em, fotos, site_nome, nota_pessoal")
      .eq("decisao", "gostei")
      .gt("fim_em", new Date(agora).toISOString())
      .lte("fim_em", new Date(agora + j.horas * 3600_000).toISOString());

    let n = 0;
    for (const f of (favs ?? []) as Fav[]) {
      const { count } = await db
        .from("alertas_enviados")
        .select("id", { count: "exact", head: true })
        .eq("lote_id", f.id)
        .eq("tipo", j.tipo);
      if (count) continue;
      // o de 24h não faz sentido se já está a menos de 2h (o de 2h cobre)
      if (j.tipo === "lembrete_24h" && new Date(f.fim_em).getTime() - agora < 2 * 3600_000) continue;

      const texto = [
        j.titulo,
        `<b>${esc(f.titulo)}</b>`,
        `Lance atual: <b>${f.lance_atual != null ? brl.format(f.lance_atual) : "—"}</b>`,
        `Encerra: ${esc(hora.format(new Date(f.fim_em)))}`,
        f.nota_pessoal ? `📝 ${esc(f.nota_pessoal)}` : null,
        `<i>${esc(f.site_nome)}</i>`,
      ]
        .filter(Boolean)
        .join("\n");
      const teclado = { inline_keyboard: [[{ text: "🔗 Abrir lote no site", url: f.url }]] };
      try {
        const msg =
          j.foto && f.fotos[0]
            ? await telegram("sendPhoto", {
                chat_id: chat,
                photo: f.fotos[0],
                caption: texto,
                parse_mode: "HTML",
                reply_markup: teclado,
              }).catch(() =>
                telegram("sendMessage", { chat_id: chat, text: texto, parse_mode: "HTML", reply_markup: teclado }),
              )
            : await telegram("sendMessage", { chat_id: chat, text: texto, parse_mode: "HTML", reply_markup: teclado });
        await db
          .from("alertas_enviados")
          .insert({ lote_id: f.id, site_id: f.site_id, tipo: j.tipo, telegram_msg_id: msg.message_id });
        n++;
      } catch (e) {
        console.error(`lembrete ${j.tipo} ${f.id}:`, e);
      }
    }
    resultado[j.tipo] = n;
  }
  return Response.json({ ok: true, ...resultado });
});
