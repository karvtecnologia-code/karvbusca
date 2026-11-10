import { cookies } from "next/headers";
import { Suspense } from "react";
import { MarcarVisita } from "@/components/marcar-visita";
import { CardLote } from "@/components/card-lote";
import { Filtros } from "@/components/filtros";
import { CAMPOS_CARD, chaveArremate, valoresLote, type Config, type LotePainel } from "@/lib/lotes";
import { supabaseServer } from "@/lib/supabase/server";

type SP = Record<string, string | undefined>;

export default async function LotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();

  const { data: cfgUf } = await supabase.from("config").select("ufs").single();
  const ufs: string[] = cfgUf?.ufs ?? ["SP", "MG"];

  let q = supabase
    .from("lotes_painel")
    .select(CAMPOS_CARD)
    .is("decisao", null) // só os ainda não decididos: favoritos vão para /favoritos, descartados somem
    .in("uf", ufs)
    .or(`fim_em.is.null,fim_em.gte.${new Date(Date.now() - 3600_000).toISOString()}`) // só abertos
    .limit(400);

  if (sp.apto !== "0") q = q.eq("apto_rodar", true);
  if (sp.site) q = q.eq("site_slug", sp.site);
  if (sp.termo) q = q.contains("termos", [sp.termo]);
  if (sp.uf) q = q.eq("uf", sp.uf);
  if (sp.roda) q = q.eq("roda", sp.roda);
  if (sp.chave) q = q.eq("chave", sp.chave);
  if (sp.tipo) q = q.eq("tipo", sp.tipo);
  if (sp.monta) q = q.in("condicao_monta", sp.monta.split(","));
  if (sp.ano) q = q.gte("ano_mod", Number(sp.ano));
  if (sp.km) q = q.lte("km", Number(sp.km));
  if (sp.lance) q = q.lte("lance_atual", Number(sp.lance));
  if (sp.h24) q = q.lte("fim_em", new Date(Date.now() + 86_400_000).toISOString());
  if (sp.breve) q = q.or("status.is.null,status.neq.estoque"); // esconder estoque "Em breve"
  if (sp.raio) q = q.lte("distancia_km", Number(sp.raio));
  if (sp.nmin) q = q.gte("nota", Number(sp.nmin));
  if (sp.desc) q = q.eq("descoberta", true);
  // busca livre: "hr-v 2017" → título/modelo contém "hr-v" e ano-modelo 2017
  for (const tok of (sp.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 4)) {
    if (/^(19|20)\d{2}$/.test(tok)) q = q.eq("ano_mod", Number(tok));
    else {
      const t = tok.replace(/[%_,()]/g, "");
      if (t) q = q.or(`titulo.ilike.%${t}%,modelo.ilike.%${t}%,versao.ilike.%${t}%`);
    }
  }

  // padrão: melhor nota de oportunidade primeiro
  const ordem = sp.ordem ?? "nota";
  if (ordem === "lance") q = q.order("lance_atual", { ascending: true, nullsFirst: false });
  else if (ordem === "novos") q = q.order("visto_primeiro_em", { ascending: false });
  else if (ordem === "fim") q = q.order("fim_em", { ascending: true, nullsFirst: false });
  else if (ordem === "nota") q = q.order("nota", { ascending: false, nullsFirst: false }).order("fim_em", { ascending: true, nullsFirst: false });

  const [{ data, error }, { data: cfg }, { data: sites }, { data: termos }, { data: arremates }] = await Promise.all([
    q,
    supabase
      .from("config")
      .select("custo_doc_padrao, custo_patio_padrao, frete_padrao, frete_por_km, chat_id_telegram, origem, nota_alerta_quente")
      .single(),
    supabase.from("sites").select("slug, nome").order("id"),
    supabase.from("termos_busca").select("id, termo").order("termo"),
    supabase.from("arremates_modelo").select("modelo_base, pct_fipe_mediana"),
  ]);
  const pctArremate = new Map((arremates ?? []).map((a) => [a.modelo_base as string, Number(a.pct_fipe_mediana)]));
  const padroes = (cfg ?? { custo_doc_padrao: 0, custo_patio_padrao: 0 }) as Config;
  const visita = Number((await cookies()).get("kb_visita")?.value ?? 0);

  let lotes = (data ?? []) as unknown as LotePainel[];
  if (sp.fipe || ordem === "fipe") {
    const pct = new Map(lotes.map((l) => [l.id, valoresLote(l, padroes).pct]));
    if (sp.fipe) lotes = lotes.filter((l) => (pct.get(l.id) ?? 9) < 0.7);
    if (ordem === "fipe") lotes.sort((a, b) => (pct.get(a.id) ?? 9) - (pct.get(b.id) ?? 9));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <h1 className="enter text-xl font-semibold tracking-tight">Lotes</h1>
        <Suspense>
          <Filtros
            total={lotes.length}
            ufs={ufs}
            sites={(sites ?? []).map((s) => ({ valor: s.slug, rotulo: s.nome }))}
            termos={(termos ?? []).map((t) => ({ valor: t.id, rotulo: t.termo }))}
          />
        </Suspense>
      </div>

      <section>
        {error && <p className="text-sm text-bad">Erro ao carregar: {error.message}</p>}
        {!error && lotes.length === 0 && (
          <div className="enter rounded-lg border border-dashed border-line px-6 py-16 text-center">
            <p className="text-sm">Nenhum lote com esses filtros.</p>
            <p className="mt-1 text-xs text-muted">
              {sp.apto !== "0"
                ? "Desligue “Só aptos a rodar” para ver também os com monta, sucata ou sem informação."
                : "O robô roda às 07:00, 12:00 e 18:00."}
            </p>
          </div>
        )}
        <ul>
          {lotes.map((l, i) => (
            <CardLote
              key={l.id}
              lote={l}
              padroes={padroes}
              indice={i}
              novo={visita > 0 && new Date(l.visto_primeiro_em).getTime() > visita}
              pctArremate={pctArremate.get(chaveArremate(l)) ?? null}
              notaQuente={cfg?.nota_alerta_quente ?? 75}
            />
          ))}
        </ul>
        <MarcarVisita />
      </section>
    </div>
  );
}
