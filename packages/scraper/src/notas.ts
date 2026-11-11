import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularLote, notaOportunidade } from "@karv/core";

/** Mesma chave da view arremates_modelo ("mitsubishi asx"). */
const chaveModelo = (l: { marca: string | null; modelo: string | null; titulo: string }) =>
  `${(l.marca ?? "").toLowerCase()} ${(l.modelo ?? l.titulo).toLowerCase().split(" ")[0]}`;

/** Recalcula a nota de oportunidade dos lotes abertos (depende de FIPE, distância e lance, que mudam). */
export async function recalcularNotas(db: SupabaseClient, log = console.log) {
  const [{ data: cfg }, { data: lotes }, { data: arremates }] = await Promise.all([
    db.from("config").select("custo_doc_padrao, custo_patio_padrao, frete_padrao, frete_por_km").single(),
    db
      .from("lotes_painel")
      .select(
        "id, titulo, marca, modelo, lance_atual, comissao_pct, taxa_adm, taxas_site, custo_patio, custo_doc, custo_frete, fipe_valor, fipe_site, distancia_km, condicao_monta, roda, circulacao, procedencia, chave, dano_estrutural, km, ano_mod, nota, nota_motivos",
      )
      .or(`fim_em.is.null,fim_em.gte.${new Date(Date.now() - 3600_000).toISOString()}`)
      .limit(3000),
    db.from("arremates_modelo").select("modelo_base, pct_fipe_mediana"),
  ]);
  if (!cfg || !lotes) return;
  const fecha = new Map((arremates ?? []).map((a) => [a.modelo_base as string, Number(a.pct_fipe_mediana)]));
  let n = 0;
  for (const l of lotes) {
    const v = calcularLote(l, cfg);
    // custo provável no fechamento: lance = mediana de fechamento do modelo × FIPE, com as mesmas taxas
    const med = fecha.get(chaveModelo(l));
    const fipe = Number(l.fipe_valor ?? l.fipe_site ?? 0);
    const provavel = med && fipe ? calcularLote({ ...l, lance_atual: med * fipe }, cfg).pct : null;
    const r = notaOportunidade({
      pctFipe: v.pct,
      pctProvavel: provavel,
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
    if (r.nota === l.nota && r.motivos.join("|") === (l.nota_motivos ?? []).join("|")) continue;
    await db.from("lotes").update({ nota: r.nota, nota_motivos: r.motivos }).eq("id", l.id);
    n++;
  }
  log(`[nota] ${n} notas atualizadas de ${lotes.length} lotes abertos`);
}
