import { CardLote } from "@/components/card-lote";
import { Selecao } from "@/components/selecao";
import { GraficoLances } from "@/components/grafico-lances";
import { chaveArremate, valoresLote, type Config, type LotePainel } from "@/lib/lotes";
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
  q = q.limit(300);

  const [{ data }, { data: cfg }, { data: sites }, { data: arremates }] = await Promise.all([
    q,
    supabase.from("config").select("custo_doc_padrao, custo_patio_padrao, frete_padrao, frete_por_km, chat_id_telegram, origem, nota_alerta_quente").single(),
    supabase.from("sites").select("slug, nome").order("id"),
    supabase.from("arremates_modelo").select("modelo_base, pct_fipe_mediana"),
  ]);
  const pctArremate = new Map((arremates ?? []).map((a) => [a.modelo_base as string, Number(a.pct_fipe_mediana)]));
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

  // mesmo card da aba Lotes (foto grande, números legíveis), com gráfico e nota embaixo
  const card = (l: LotePainel, i: number) => {
    const pontos = porLote.get(l.id) ?? [];
    const v = valoresLote(l, padroes);
    return (
      <CardLote key={l.id} notaQuente={cfg?.nota_alerta_quente ?? 75} lote={l} padroes={padroes} indice={i} modo="favoritos" pctArremate={pctArremate.get(chaveArremate(l)) ?? null}>
        <div className={`grid gap-3 ${pontos.length > 1 ? "sm:grid-cols-[1fr_280px] sm:items-end" : ""}`}>
          {pontos.length > 1 && <GraficoLances pontos={pontos} fipe={v.fipe} compacto />}
          <NotaFavorito loteId={l.id} nota={l.nota_pessoal} />
        </div>
      </CardLote>
    );
  };

  return (
    <section className="space-y-5 sm:space-y-6">
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
      <Selecao ids={lotes.map((l) => l.id)} modo="favoritos">
      <ul>{abertos.map(card)}</ul>
      {encerrados.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted">
            🏁 Encerrados ({encerrados.length}) · <span className="font-normal">por quanto foram (último lance visto)</span>
          </h2>
          <ul className="mt-3">{encerrados.map(card)}</ul>
        </div>
      )}
      </Selecao>
    </section>
  );
}
