import type { SupabaseClient } from "@supabase/supabase-js";
import { analisarLoteIA, calcularLote, ErroIA, fotosParaIA, quando, reais, ROTULO_MONTA, ROTULO_RODA } from "@karv/core";

/**
 * IA automática só nos melhores lotes (nota alta), respeitando um limite diário pequeno
 * (config.ia_auto_max_dia, padrão 5) para caber no plano gratuito do Gemini.
 */
export async function iaAutomatica(db: SupabaseClient, log = console.log) {
  const [{ data: cfg }, { data: chave }] = await Promise.all([
    db
      .from("config")
      .select("ia_base_url, ia_modelo, ia_auto_max_dia, nota_alerta_quente, custo_doc_padrao, custo_patio_padrao, frete_padrao, frete_por_km")
      .single(),
    db.rpc("ia_chave"),
  ]);
  if (!cfg || !chave || !cfg.ia_auto_max_dia) return;

  const hojeBR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { count: feitas } = await db
    .from("lote_ia")
    .select("lote_id", { count: "exact", head: true })
    .like("modelo", "auto:%")
    .gte("gerado_em", `${hojeBR}T00:00:00-03:00`);
  const restam = cfg.ia_auto_max_dia - (feitas ?? 0);
  if (restam <= 0) return log(`[ia] limite diário (${cfg.ia_auto_max_dia}) já usado`);

  const { data: ja } = await db.from("lote_ia").select("lote_id");
  const feitos = new Set((ja ?? []).map((x) => x.lote_id));
  const { data: candidatos } = await db
    .from("lotes_painel")
    .select("*")
    .eq("apto_rodar", true)
    .is("decisao", null)
    .gte("nota", cfg.nota_alerta_quente)
    .gt("fim_em", new Date().toISOString())
    .order("nota", { ascending: false })
    .limit(restam + 20);

  let n = 0;
  for (const l of (candidatos ?? []).filter((c) => !feitos.has(c.id)).slice(0, restam)) {
    const v = calcularLote(l, cfg);
    const ficha = [
      `Veículo: ${l.titulo} | Site: ${l.site_nome}`,
      `Ano: ${l.ano_fab ?? "?"}/${l.ano_mod ?? "?"} | Km: ${l.km ?? "não informado"} | Local: ${l.cidade ?? "?"}-${l.uf}${l.distancia_km != null ? ` (${l.distancia_km} km da cidade do comprador)` : ""}`,
      `Sistema: ${ROTULO_MONTA[l.condicao_monta]} | ${ROTULO_RODA[l.roda]} | circulação ${l.circulacao} | procedência ${l.procedencia}`,
      `Lance: ${reais(l.lance_atual)} | Custo real: ${reais(v.custo)} | FIPE: ${reais(v.fipe)} | ${v.pct != null ? Math.round(v.pct * 100) + "% FIPE" : ""} | Encerra: ${quando(l.fim_em)}`,
      `\nTexto do site:\n${(l.observacoes ?? l.descricao ?? "").slice(0, 3000)}`,
    ].join("\n");
    try {
      const { analise, modelo } = await analisarLoteIA(
        { base: cfg.ia_base_url, modelo: cfg.ia_modelo, chave: chave as string },
        ficha,
        await fotosParaIA(l.fotos, 2),
      );
      await db.from("lote_ia").upsert({ lote_id: l.id, analise, modelo: `auto:${modelo}`, gerado_em: new Date().toISOString() });
      n++;
    } catch (e) {
      log(`[ia] ${l.titulo}: ${(e as Error).message}`);
      if (e instanceof ErroIA && (e.status === 429 || e.status === 404)) break; // limite/modelo: para o dia
    }
  }
  log(`[ia] ${n} análises automáticas (limite ${cfg.ia_auto_max_dia}/dia)`);
}
