import type { SupabaseClient } from "@supabase/supabase-js";

const DIA = 86_400_000;

/**
 * Mantém o banco pequeno (plano grátis): apaga o que já não serve.
 * - logs de execução com mais de 30 dias
 * - lotes encerrados há mais de 90 dias que NÃO são favoritos (o histórico, os termos e os alertas
 *   saem junto, em cascata). Descartes continuam valendo: a decisão fica em `decisoes`, por site + id.
 * 90 dias de encerrados bastam para o "preço provável de arremate".
 */
export async function limparAntigos(db: SupabaseClient, log = console.log) {
  const corteLogs = new Date(Date.now() - 30 * DIA).toISOString();
  const { count: logs } = await db.from("execucoes_robo").delete({ count: "exact" }).lt("inicio", corteLogs);

  const corteLotes = new Date(Date.now() - 90 * DIA).toISOString();
  const { data: velhos } = await db.from("lotes").select("id, site_id, id_externo").lt("fim_em", corteLotes).limit(1000);
  let apagados = 0;
  if (velhos?.length) {
    const { data: favs } = await db.from("decisoes").select("site_id, id_externo").eq("decisao", "gostei");
    const fav = new Set((favs ?? []).map((f) => `${f.site_id}|${f.id_externo}`));
    const ids = velhos.filter((l) => !fav.has(`${l.site_id}|${l.id_externo}`)).map((l) => l.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { count } = await db.from("lotes").delete({ count: "exact" }).in("id", ids.slice(i, i + 200));
      apagados += count ?? 0;
    }
  }
  log(`[limpeza] ${logs ?? 0} logs antigos e ${apagados} lotes encerrados há +90 dias apagados`);
}
