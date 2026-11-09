import type { SupabaseClient } from "@supabase/supabase-js";
import {
  custoReal,
  esc,
  pctFipe,
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
  const { data } = await db.from("config").select("chat_id_telegram, custo_doc_padrao, custo_patio_padrao").single();
  return data;
}

/** Custo real e % FIPE de um lote, com os padrões da config. */
export function valores(l: LoteAlerta, cfg: Config) {
  const lance = Number(l.lance_atual ?? 0);
  // a taxa do site (Loop) já inclui estadia/pátio; senão usamos o padrão
  const patio = l.custo_patio ?? (l.taxas_site != null ? 0 : Number(cfg.custo_patio_padrao));
  const custo = custoReal({
    lance,
    comissaoPct: Number(l.sites.comissao_pct),
    taxaAdm: Number(l.sites.taxa_adm) + Number(l.taxas_site ?? 0),
    patio,
    documentacao: l.custo_doc ?? Number(cfg.custo_doc_padrao),
  });
  const fipe = l.fipe_valor ?? l.fipe_site;
  return { custo, fipe, pct: lance ? pctFipe(custo, fipe) : null };
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
