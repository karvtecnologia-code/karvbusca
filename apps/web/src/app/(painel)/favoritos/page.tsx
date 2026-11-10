import Link from "next/link";
import { Contagem } from "@/components/contagem";
import { Etiqueta } from "@/components/etiqueta";
import { GraficoLances } from "@/components/grafico-lances";
import { anosFmt, kmFmt, MONTA, quando, reais, valoresLote, type Config, type LotePainel } from "@/lib/lotes";
import { supabaseServer } from "@/lib/supabase/server";
import { Suspense } from "react";
import { FiltrosFav } from "./filtros-fav";
import { NotaFavorito } from "./nota";

export default async function FavoritosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  let q = supabase.from("lotes_painel").select("*").eq("decisao", "gostei");
  if (sp.site) q = q.eq("site_slug", sp.site);
  if (sp.h24) q = q.lte("fim_em", new Date(Date.now() + 86_400_000).toISOString());
  for (const tok of (sp.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 4)) {
    const t = tok.replace(/[%_,()]/g, "");
    if (t) q = q.or(`titulo.ilike.%${t}%,modelo.ilike.%${t}%`);
  }
  if (sp.ordem === "lance") q = q.order("lance_atual", { ascending: true, nullsFirst: false });
  else q = q.order("fim_em", { ascending: sp.ordem !== "fim_desc", nullsFirst: false });

  const [{ data }, { data: cfg }, { data: sites }] = await Promise.all([
    q,
    supabase.from("config").select("custo_doc_padrao, custo_patio_padrao, frete_padrao, chat_id_telegram, origem").single(),
    supabase.from("sites").select("slug, nome").order("id"),
  ]);
  const lotes = (data ?? []) as LotePainel[];
  const padroes = cfg as Config;
  if (sp.ordem === "fipe") {
    const pct = (l: LotePainel) => valoresLote(l, padroes).pct ?? 9;
    lotes.sort((a, b) => pct(a) - pct(b));
  }
  const { data: hist } = lotes.length
    ? await supabase
        .from("lotes_historico")
        .select("lote_id, capturado_em, lance_atual")
        .in("lote_id", lotes.map((l) => l.id))
        .order("capturado_em")
    : { data: [] };
  const porLote = new Map<string, { t: string; v: number }[]>();
  for (const h of hist ?? []) {
    if (!h.lance_atual) continue;
    if (!porLote.has(h.lote_id)) porLote.set(h.lote_id, []);
    porLote.get(h.lote_id)!.push({ t: h.capturado_em, v: Number(h.lance_atual) });
  }
  const agora = Date.now();
  const abertos = lotes.filter((l) => !l.fim_em || new Date(l.fim_em).getTime() > agora);
  const encerrados = lotes.filter((l) => l.fim_em && new Date(l.fim_em).getTime() <= agora);

  const card = (l: LotePainel, i: number) => {
    const v = valoresLote(l, padroes);
    const monta = MONTA[l.condicao_monta] ?? MONTA.nao_informado!;
    return (
      <li key={l.id} className="enter rounded-lg border border-line bg-surface p-3" style={{ animationDelay: `${i * 30}ms` }}>
        <div className="flex gap-3">
          <Link href={`/lote/${l.id}`} className="w-24 shrink-0 overflow-hidden rounded-md bg-raised">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {l.fotos[0] && <img src={l.fotos[0]} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/lote/${l.id}`} className="line-clamp-1 text-sm font-medium hover:text-amber">
                {l.titulo}
              </Link>
              <Contagem fim={l.fim_em} className="shrink-0 text-sm" />
            </div>
            <p className="num truncate text-xs text-muted">
              {[anosFmt(l.ano_fab, l.ano_mod), kmFmt(l.km), [l.cidade, l.uf].filter(Boolean).join("-"), l.site_nome]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="num mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span>
                <span className="text-faint">Lance </span>
                {reais(l.lance_atual)}
              </span>
              <span>
                <span className="text-faint">Custo </span>
                {reais(v.custo)}
              </span>
              <span className={v.pct != null && v.pct < 0.7 ? "text-[#8fc9a1]" : ""}>
                <span className="text-faint">FIPE </span>
                {v.pct != null ? `${Math.round(v.pct * 100)}%` : "—"}
              </span>
              <Etiqueta tom={monta.tom}>{monta.rotulo}</Etiqueta>
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_260px] sm:items-end">
          <GraficoLances pontos={porLote.get(l.id) ?? []} fipe={v.fipe} compacto />
          <NotaFavorito loteId={l.id} nota={l.nota} />
        </div>
        <p className="mt-2 text-[11px] text-faint">Encerra {quando(l.fim_em)}</p>
      </li>
    );
  };

  return (
    <section className="space-y-6">
      <header className="enter space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Favoritos</h1>
        <p className="text-sm text-muted">
          Você recebe no Telegram as mudanças de lance e os lembretes de 24h e 2h.
        </p>
      </header>
      <Suspense>
        <FiltrosFav total={abertos.length} sites={(sites ?? []).map((s) => ({ valor: s.slug, rotulo: s.nome }))} />
      </Suspense>
      {abertos.length === 0 && (
        <p className="rounded-lg border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
          Nenhum favorito aberto. Toque em 👍 Gostei num lote ou no Telegram.
        </p>
      )}
      <ul className="space-y-3">{abertos.map(card)}</ul>
      {encerrados.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted select-none hover:text-fg">
            Encerrados ({encerrados.length})
          </summary>
          <ul className="mt-3 space-y-3 opacity-70">{encerrados.map(card)}</ul>
        </details>
      )}
    </section>
  );
}
