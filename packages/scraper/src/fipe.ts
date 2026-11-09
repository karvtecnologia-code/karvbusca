import type { SupabaseClient } from "@supabase/supabase-js";
import { Fipe } from "@karv/core";

const UM_MES = 30 * 24 * 3600 * 1000;

/** Preenche/atualiza a FIPE dos lotes ainda abertos (1 vez por mês por lote). */
export async function atualizarFipe(db: SupabaseClient, log = console.log, limite = 60) {
  const corte = new Date(Date.now() - UM_MES).toISOString();
  const { data, error } = await db
    .from("lotes")
    .select("id, tipo, marca, modelo, versao, titulo, ano_mod, ano_fab, combustivel, fipe_codigo, fipe_aproximada")
    .or(`fipe_atualizado_em.is.null,fipe_atualizado_em.lt.${corte}`)
    .or(`fim_em.is.null,fim_em.gte.${new Date(Date.now() - 86400_000).toISOString()}`)
    .limit(limite);
  if (error) throw error;

  const fipe = new Fipe();
  let ok = 0;
  for (const l of data ?? []) {
    const anoMod = l.ano_mod ?? l.ano_fab;
    try {
      // código corrigido à mão no painel tem prioridade
      const r =
        l.fipe_codigo && !l.fipe_aproximada && anoMod
          ? await fipe.porCodigo(l.fipe_codigo, anoMod, l.tipo === "moto", l.combustivel ?? undefined)
          : await fipe.buscar({ ...l, anoMod });
      await db
        .from("lotes")
        .update({
          fipe_atualizado_em: new Date().toISOString(),
          ...(r ? { fipe_codigo: r.codigo, fipe_valor: r.valor, fipe_aproximada: r.aproximada } : {}),
        })
        .eq("id", l.id);
      if (r) ok++;
    } catch (e) {
      log(`[fipe] ${l.titulo}: ${(e as Error).message}`);
      if (/HTTP 429/.test((e as Error).message)) break; // limite diário da API
    }
  }
  log(`[fipe] ${ok}/${data?.length ?? 0} lotes com FIPE (${fipe.consultas} consultas)`);
}
