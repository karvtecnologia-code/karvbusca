import Link from "next/link";
import { notFound } from "next/navigation";
import { Contagem } from "@/components/contagem";
import { Etiqueta } from "@/components/etiqueta";
import { GraficoLances } from "@/components/grafico-lances";
import { anosFmt, kmFmt, MONTA, PROCEDENCIA, quando, reais, RODA, type Config, type LotePainel } from "@/lib/lotes";
import { supabaseServer } from "@/lib/supabase/server";
import { Calculadora } from "./calculadora";
import { Decisao } from "./decisao";
import { FipeForm } from "./fipe-form";
import { Galeria } from "./galeria";
import { LoteIA } from "./lote-ia";
import type { AnaliseIA } from "@/lib/ia";

export default async function LotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const [{ data: lote }, { data: hist }, { data: cfg }, { data: ia }, { data: msgs }] = await Promise.all([
    supabase.from("lotes_painel").select("*").eq("id", id).maybeSingle(),
    supabase.from("lotes_historico").select("capturado_em, lance_atual").eq("lote_id", id).order("capturado_em"),
    supabase
      .from("config")
      .select("custo_doc_padrao, custo_patio_padrao, frete_padrao, chat_id_telegram, origem, ia_secret_id")
      .single(),
    supabase.from("lote_ia").select("analise, modelo, gerado_em").eq("lote_id", id).maybeSingle(),
    supabase.from("lote_ia_mensagens").select("papel, texto").eq("lote_id", id).order("criado_em"),
  ]);
  if (!lote) notFound();
  const l = lote as LotePainel;
  const padroes = cfg as Config;
  const monta = MONTA[l.condicao_monta] ?? MONTA.nao_informado!;
  const roda = RODA[l.roda] ?? RODA.nao_informado!;
  const fipe = l.fipe_valor ?? l.fipe_site;

  const ficha: [string, React.ReactNode][] = [
    ["Ano", anosFmt(l.ano_fab, l.ano_mod) ?? "—"],
    ["Km", kmFmt(l.km) ?? "—"],
    ["Local", [l.cidade, l.uf].filter(Boolean).join(" - ") || "—"],
    ["Combustível", l.combustivel ?? "—"],
    ["Procedência", PROCEDENCIA[l.procedencia] ?? "—"],
    ["Chave", l.chave === "sim" ? "Sim" : l.chave === "nao" ? "Não" : "—"],
    ["Circulação", l.circulacao === "vedada" ? "Vedada" : l.circulacao === "liberada" ? "Liberada" : "—"],
    ["Financiável", l.financiavel == null ? "—" : l.financiavel ? "Sim" : "Não"],
    ["IPVA pago", l.ipva_pago == null ? "—" : l.ipva_pago ? "Sim" : "Não"],
    ["Lance inicial", reais(l.lance_inicial)],
  ];

  return (
    <article className="space-y-6">
      <Link href="/" className="text-xs text-muted hover:text-fg">
        ← Lotes
      </Link>

      <header className="enter flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-balance">{l.titulo}</h1>
          <div className="flex flex-wrap gap-1">
            <Etiqueta tom={monta.tom}>{monta.rotulo}</Etiqueta>
            <Etiqueta tom={roda.tom}>{roda.rotulo}</Etiqueta>
            {l.apto_rodar ? <Etiqueta tom="ok">Apto a rodar</Etiqueta> : <Etiqueta tom="bad">Não apto</Etiqueta>}
            {l.circulacao === "vedada" && <Etiqueta tom="bad">Circulação vedada</Etiqueta>}
            {l.dano_detalhe.map((d) => (
              <Etiqueta key={d} tom="bad">
                {d}
              </Etiqueta>
            ))}
          </div>
          <p className="text-xs text-muted">
            {l.site_nome} · encerra {quando(l.fim_em)} · <Contagem fim={l.fim_em} />
          </p>
        </div>
        <Decisao loteId={l.id} url={l.url} decisao={l.decisao} nota={l.nota_pessoal} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Galeria fotos={l.fotos} />

          <LoteIA
            loteId={l.id}
            analise={(ia?.analise as AnaliseIA) ?? null}
            geradoEm={ia?.gerado_em ?? null}
            modelo={ia?.modelo ?? null}
            mensagens={(msgs ?? []) as { papel: "user" | "assistant"; texto: string }[]}
            configurada={!!cfg?.ia_secret_id}
          />

          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="mb-3 text-sm font-medium">Histórico de lances</h2>
            <GraficoLances
              pontos={(hist ?? []).filter((h) => h.lance_atual).map((h) => ({ t: h.capturado_em, v: Number(h.lance_atual) }))}
              fipe={fipe}
            />
          </section>

          {(l.observacoes || l.descricao) && (
            <section className="rounded-lg border border-line bg-surface p-4">
              <h2 className="mb-2 text-sm font-medium">Observações do site</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-muted">{l.observacoes ?? l.descricao}</p>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="mb-3 text-sm font-medium">Ficha</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {ficha.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] text-faint">{k}</dt>
                  <dd className="num">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Calculadora lote={l} padroes={padroes} />
          <FipeForm loteId={l.id} codigo={l.fipe_codigo} valor={fipe} aproximada={l.fipe_aproximada} doSite={!l.fipe_valor && !!l.fipe_site} />
        </aside>
      </div>
    </article>
  );
}
