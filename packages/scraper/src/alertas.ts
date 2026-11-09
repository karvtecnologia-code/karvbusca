import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcularLote,
  esc,
  quando,
  reais,
  ROTULO_MONTA,
  ROTULO_RODA,
  Telegram,
  tecladoLote,
} from "@karv/core";

interface Config {
  chat_id_telegram: number | null;
  custo_doc_padrao: number;
  custo_patio_padrao: number;
  frete_padrao: number | null;
}

interface LoteAlerta {
  id: string;
  site_id: number;
  id_externo: string;
  url: string;
  titulo: string;
  ano_fab: number | null;
  ano_mod: number | null;
  km: number | null;
  cidade: string | null;
  uf: string | null;
  lance_atual: number | null;
  lance_anterior: number | null;
  fim_em: string | null;
  fotos: string[];
  condicao_monta: string;
  roda: string;
  circulacao: string;
  chave: string;
  taxas_site: number | null;
  fipe_valor: number | null;
  fipe_site: number | null;
  custo_patio: number | null;
  custo_doc: number | null;
  alerta_pendente: "novo" | "lance";
  sites: { nome: string; comissao_pct: number; taxa_adm: number };
}

export function telegramDoAmbiente(): Telegram | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.replace(/^﻿/, "").trim();
  return token ? new Telegram(token) : null;
}

async function carregarConfig(db: SupabaseClient): Promise<Config | null> {
  const { data } = await db.from("config").select("chat_id_telegram, custo_doc_padrao, custo_patio_padrao, frete_padrao").single();
  return data;
}

/** Custo real e % FIPE de um lote, com os padrões da config. */
export function valores(l: LoteAlerta, cfg: Config) {
  return calcularLote({ ...l, comissao_pct: l.sites.comissao_pct, taxa_adm: l.sites.taxa_adm }, cfg);
}

function legenda(l: LoteAlerta, cfg: Config): string {
  const { custo, fipe, pct } = valores(l, cfg);
  const ano = l.ano_fab || l.ano_mod ? `${l.ano_fab ?? "?"}/${l.ano_mod ?? "?"}` : null;
  const km = l.km != null ? `${l.km.toLocaleString("pt-BR")} km` : null;
  const local = [l.cidade, l.uf].filter(Boolean).join("-");
  const pctTxt = pct != null ? ` · <b>${Math.round(pct * 100)}% FIPE</b>${pct < 0.7 ? " 🟢" : ""}` : "";
  const extras = [
    l.circulacao === "liberada" ? "🛣 em circulação" : null,
    l.chave === "sim" ? "🔑 com chave" : l.chave === "nao" ? "🔑 sem chave" : null,
  ].filter(Boolean);

  const topo =
    l.alerta_pendente === "lance"
      ? `💸 <b>Lance mudou</b>: ${reais(l.lance_anterior)} → <b>${reais(l.lance_atual)}</b>\n`
      : "";
  return [
    `${topo}<b>${esc(l.titulo)}</b>`,
    [ano, km, local].filter(Boolean).map(esc).join(" · "),
    `Lance: <b>${reais(l.lance_atual)}</b>${pctTxt}`,
    `Custo real ≈ ${reais(custo)}${fipe ? ` · FIPE ${reais(fipe)}` : ""}`,
    `${ROTULO_MONTA[l.condicao_monta] ?? ""} · ${ROTULO_RODA[l.roda] ?? ""}${extras.length ? " · " + extras.join(" · ") : ""}`,
    `⏰ Encerra: ${esc(quando(l.fim_em))}`,
    `<i>${esc(l.sites.nome)}</i>`,
  ].join("\n");
}

/** Envia os alertas pendentes (lote novo e lance mudou) e limpa a fila. */
export async function enviarPendentes(db: SupabaseClient, log = console.log) {
  const tg = telegramDoAmbiente();
  const cfg = await carregarConfig(db);
  if (!tg || !cfg?.chat_id_telegram) {
    log("[telegram] sem token ou chat_id ainda: alertas ficam na fila");
    return 0;
  }
  const { data, error } = await db
    .from("lotes")
    .select("*, sites(nome, comissao_pct, taxa_adm)")
    .not("alerta_pendente", "is", null)
    .order("fim_em", { ascending: true })
    .limit(30); // limite por execução para não inundar o celular
  if (error) throw error;

  let enviados = 0;
  for (const l of (data ?? []) as LoteAlerta[]) {
    const { data: dec } = await db
      .from("decisoes")
      .select("decisao")
      .eq("site_id", l.site_id)
      .eq("id_externo", l.id_externo)
      .maybeSingle();
    const limpar = () => db.from("lotes").update({ alerta_pendente: null }).eq("id", l.id);

    if (dec?.decisao === "descartado") {
      await limpar();
      continue;
    }
    // "novo" só uma vez por lote (índice único em alertas_enviados)
    if (l.alerta_pendente === "novo") {
      const { count } = await db
        .from("alertas_enviados")
        .select("id", { count: "exact", head: true })
        .eq("lote_id", l.id)
        .eq("tipo", "novo");
      if (count) {
        await limpar();
        continue;
      }
    }
    try {
      const msg = await tg.enviarFoto(
        cfg.chat_id_telegram,
        l.fotos[0],
        legenda(l, cfg),
        tecladoLote(l.id, l.url, dec?.decisao === "gostei" ? "gostei" : undefined),
      );
      await db.from("alertas_enviados").insert({
        lote_id: l.id,
        site_id: l.site_id,
        tipo: l.alerta_pendente,
        telegram_msg_id: msg.message_id,
      });
      await limpar();
      enviados++;
      await new Promise((r) => setTimeout(r, 1200)); // o Telegram limita ~1 msg/s por chat
    } catch (e) {
      log(`[telegram] falha ao enviar ${l.id}: ${(e as Error).message}`);
    }
  }
  log(`[telegram] ${enviados} alerta(s) enviado(s)`);
  return enviados;
}

/** Favorito que não aparece mais na listagem do site, ainda antes do encerramento. */
export async function avisarSumiu(db: SupabaseClient, l: { id: string; site_id: number; titulo: string; url: string; site: string }) {
  const tg = telegramDoAmbiente();
  const cfg = await carregarConfig(db);
  const { count } = await db
    .from("alertas_enviados")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", l.id)
    .eq("tipo", "sumiu");
  if (count) return;
  await db.from("lotes").update({ status: "retirado" }).eq("id", l.id);
  if (!tg || !cfg?.chat_id_telegram) return;
  const msg = await tg.enviarTexto(
    cfg.chat_id_telegram,
    `👻 <b>Favorito sumiu do site</b>\n${esc(l.titulo)}\nNão aparece mais na listagem da ${esc(l.site)} (vendido antes, retirado ou adiado).`,
    [[{ text: "🔗 Conferir no site", url: l.url }]],
  );
  await db.from("alertas_enviados").insert({ lote_id: l.id, site_id: l.site_id, tipo: "sumiu", telegram_msg_id: msg.message_id });
}

/** Resumo da manhã: aptos novos em 24h, o que encerra hoje e os melhores em % FIPE. Uma vez por dia. */
export async function enviarResumo(db: SupabaseClient, log = console.log) {
  const tg = telegramDoAmbiente();
  const cfg = await carregarConfig(db);
  if (!tg || !cfg?.chat_id_telegram) return;
  const hojeBR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD
  const inicioDia = new Date(`${hojeBR}T00:00:00-03:00`);
  const fimDia = new Date(`${hojeBR}T23:59:59-03:00`);
  const { count: ja } = await db
    .from("alertas_enviados")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "resumo")
    .gte("enviado_em", inicioDia.toISOString());
  if (ja) return;

  const agora = new Date().toISOString();
  const { data } = await db
    .from("lotes_painel")
    .select("titulo, lance_atual, fim_em, url, site_nome, visto_primeiro_em, decisao, comissao_pct, taxa_adm, taxas_site, custo_patio, custo_doc, custo_frete, fipe_valor, fipe_site")
    .eq("apto_rodar", true)
    .in("uf", ["SP", "MG"])
    .or("decisao.is.null,decisao.eq.gostei")
    .gt("fim_em", agora);
  const lotes = data ?? [];
  const novos = lotes.filter((l) => new Date(l.visto_primeiro_em).getTime() > Date.now() - 86_400_000);
  const hoje = lotes.filter((l) => new Date(l.fim_em!).getTime() <= fimDia.getTime());
  const melhores = lotes
    .map((l) => ({ l, pct: calcularLote(l, cfg).pct }))
    .filter((x) => x.pct != null)
    .sort((a, b) => a.pct! - b.pct!)
    .slice(0, 3);

  const linha = (l: (typeof lotes)[number], extra = "") =>
    `• <a href="${esc(l.url)}">${esc(l.titulo)}</a> — ${reais(l.lance_atual)}${extra} · <i>${esc(l.site_nome)}</i>`;
  const texto = [
    `☀️ <b>Bom dia! Resumo KarvBusca</b>`,
    `${lotes.length} lotes aptos abertos · <b>${novos.length}</b> novos nas últimas 24h · <b>${hoje.length}</b> encerram hoje`,
    melhores.length ? `\n<b>Melhores em % FIPE</b>\n${melhores.map((x) => linha(x.l, ` · ${Math.round(x.pct! * 100)}% FIPE`)).join("\n")}` : null,
    hoje.length ? `\n<b>Encerram hoje</b>\n${hoje.slice(0, 8).map((l) => linha(l, ` · ${quando(l.fim_em)}`)).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const msg = await tg.enviarTexto(cfg.chat_id_telegram, texto);
  await db.from("alertas_enviados").insert({ tipo: "resumo", telegram_msg_id: msg.message_id });
  log("[telegram] resumo diário enviado");
}

/** Alerta "robô do <site> falhou". */
export async function avisarFalha(db: SupabaseClient, site: { id: number; nome: string }, erro: string) {
  const tg = telegramDoAmbiente();
  const cfg = await carregarConfig(db);
  if (!tg || !cfg?.chat_id_telegram) return;
  const run = process.env.GITHUB_RUN_ID
    ? `\n\n<a href="https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}">ver execução e screenshot</a>`
    : "";
  const msg = await tg.enviarTexto(
    cfg.chat_id_telegram,
    `⚠️ <b>Robô da ${esc(site.nome)} falhou</b> 2 vezes seguidas.\n<code>${esc(erro.slice(0, 400))}</code>${run}`,
  );
  await db.from("alertas_enviados").insert({ site_id: site.id, tipo: "robo_falhou", telegram_msg_id: msg.message_id });
}
