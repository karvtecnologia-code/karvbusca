import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularLote, notaOportunidade } from "@karv/core";

/** Recalcula a nota de oportunidade dos lotes abertos (depende de FIPE, distância e lance, que mudam). */
export async function recalcularNotas(db: SupabaseClient, log = console.log) {
  const [{ data: cfg }, { data: lotes }] = await Promise.all([
    db.from("config").select("custo_doc_padrao, custo_patio_padrao, frete_padrao, frete_por_km").single(),
    db
      .from("lotes_painel")
      .select(
        "id, lance_atual, comissao_pct, taxa_adm, taxas_site, custo_patio, custo_doc, custo_frete, fipe_valor, fipe_site, distancia_km, condicao_monta, roda, circulacao, procedencia, chave, dano_estrutural, km, ano_mod, nota",
      )
      .or(`fim_em.is.null,fim_em.gte.${new Date(Date.now() - 3600_000).toISOString()}`)
      .limit(3000),
  ]);
  if (!cfg || !lotes) return;
  let n = 0;
  for (const l of lotes) {
    const v = calcularLote(l, cfg);
    const r = notaOportunidade({
      pctFipe: v.pct,
      monta: l.condicao_monta,
      roda: l.roda,
      circulacao: l.circulacao,
      procedencia: l.procedencia,
      chave: l.chave,
      danoEstrutural: l.dano_estrutural,
      km: l.km,
      anoMod: l.ano_mod,
      distanciaKm: l.distancia_km,
    });
    if (r.nota === l.nota) continue;
    await db.from("lotes").update({ nota: r.nota, nota_motivos: r.motivos }).eq("id", l.id);
    n++;
  }
  log(`[nota] ${n} notas atualizadas de ${lotes.length} lotes abertos`);
}
