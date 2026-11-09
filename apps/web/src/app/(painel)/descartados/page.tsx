import { quando, reais } from "@/lib/lotes";
import { supabaseServer } from "@/lib/supabase/server";
import { Desfazer } from "./desfazer";

export default async function DescartadosPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("lotes_painel")
    .select("id, titulo, site_nome, uf, lance_atual, decidido_em, url")
    .eq("decisao", "descartado")
    .order("decidido_em", { ascending: false })
    .limit(300);

  return (
    <section className="space-y-6">
      <header className="enter space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Descartados</h1>
        <p className="text-sm text-muted">Lotes ignorados para sempre. Desfaça aqui um clique errado.</p>
      </header>
      {!data?.length && <p className="text-sm text-muted">Nada descartado.</p>}
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {(data ?? []).map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <a href={l.url} target="_blank" rel="noreferrer" className="block truncate text-sm hover:text-amber">
                {l.titulo}
              </a>
              <p className="num text-xs text-faint">
                {l.site_nome} · {l.uf ?? "—"} · {reais(l.lance_atual)} · descartado {quando(l.decidido_em)}
              </p>
            </div>
            <Desfazer loteId={l.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
