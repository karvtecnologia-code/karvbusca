"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { PadroesCusto } from "@karv/core";
import { decidir } from "@/app/(painel)/lotes-actions";
import { anosFmt, corNota, kmFmt, MONTA, quando, reais, RODA, valoresLote, type LotePainel } from "@/lib/lotes";
import { Contagem } from "./contagem";
import { Etiqueta } from "./etiqueta";

export function CardLote({
  lote: l,
  padroes,
  indice = 0,
  novo = false,
  modo = "lotes",
  children,
  pctArremate = null,
  notaQuente = 75,
}: {
  /** mediana de quanto este modelo fecha em relação à FIPE (arremates_modelo) */
  pctArremate?: number | null;
  notaQuente?: number;
  lote: LotePainel;
  padroes: PadroesCusto;
  indice?: number;
  novo?: boolean;
  /** "favoritos": botão "Ver no site" em destaque e o card sai só ao desfavoritar/descartar */
  modo?: "lotes" | "favoritos";
  /** conteúdo extra embaixo do card (gráfico, nota) */
  children?: React.ReactNode;
}) {
  const [decisao, setDecisao] = useState(l.decisao);
  const [saindo, setSaindo] = useState(false);
  const [, start] = useTransition();
  const v = valoresLote(l, padroes);
  const monta = MONTA[l.condicao_monta] ?? MONTA.nao_informado!;
  const roda = RODA[l.roda] ?? RODA.nao_informado!;
  const local = [l.cidade, l.uf].filter(Boolean).join("-");
  const linha = [anosFmt(l.ano_fab, l.ano_mod), kmFmt(l.km), local, l.distancia_km != null ? `${l.distancia_km} km de você` : null]
    .filter(Boolean)
    .join(" · ");

  const marcar = (d: "gostei" | "descartado") => {
    const nova = decisao === d ? null : d;
    // Lotes só mostra os não decididos; Favoritos só os favoritos: o card sai quando deixa de pertencer à aba
    if (modo === "lotes" ? nova !== null : nova !== "gostei") setSaindo(true);
    setDecisao(nova);
    start(() => decidir(l.id, nova));
  };

  return (
    // grid 1fr → 0fr fecha a altura suavemente ao descartar
    <li
      className={`enter grid transition-[grid-template-rows,opacity,translate] duration-[220ms] ease-[var(--ease-out)] ${
        saindo ? "pointer-events-none -translate-x-3 grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
      }`}
      style={{ animationDelay: `${Math.min(indice, 10) * 25}ms` }}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="group mb-3 rounded-lg border border-line bg-surface transition-colors duration-150 hover:border-line-strong">
        <article className="flex gap-3 p-2.5 sm:gap-4 sm:p-3">
          <Link href={`/lote/${l.id}`} className="relative block w-28 shrink-0 overflow-hidden rounded-md bg-raised sm:w-44">
            {l.fotos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={l.fotos[0]}
                alt=""
                loading="lazy"
                className="aspect-[4/3] h-full w-full object-cover transition-transform duration-200 ease-[var(--ease-out)] group-hover:scale-[1.02]"
              />
            ) : (
              <div className="grid aspect-[4/3] h-full place-items-center text-xs text-faint">sem foto</div>
            )}
            {novo && decisao !== "gostei" && (
              <span className="absolute top-1.5 left-1.5 rounded bg-amber px-1.5 py-0.5 text-[11px] font-medium text-bg">
                Novo
              </span>
            )}
            {decisao === "gostei" && (
              <span className="absolute top-1.5 left-1.5 rounded bg-bg/80 px-1.5 py-0.5 text-[11px] text-amber backdrop-blur">
                ★ Favorito
              </span>
            )}
          </Link>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/lote/${l.id}`} className="line-clamp-2 text-sm font-medium hover:text-amber sm:text-[15px]">
                  {l.titulo}
                </Link>
                <p className="num mt-0.5 truncate text-xs text-muted">{linha || "—"}</p>
              </div>
              <div className="flex shrink-0 items-start gap-3">
                <div className="hidden text-right sm:block">
                  <div className="num text-base font-medium">{reais(l.lance_atual)}</div>
                  <div className="text-[11px] text-faint">lance atual</div>
                </div>
                {l.nota != null && (
                  <div
                    title={`Nota de oportunidade: ${l.nota_motivos.join(" · ") || "—"}`}
                    className={`num grid size-11 shrink-0 place-items-center rounded-lg border text-center leading-none ${corNota(l.nota)}`}
                  >
                    <span className="text-base font-semibold">{l.nota}</span>
                    <span className="text-[9px] opacity-70">{l.nota >= notaQuente ? "🔥 nota" : "nota"}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {l.status === "estoque" && (
                <Etiqueta tom="warn" title="Estoque da Loop ainda sem leilão marcado: sem data e sem lance">
                  Em breve
                </Etiqueta>
              )}
              {l.status === "retirado" && <Etiqueta tom="bad">Saiu do site</Etiqueta>}
              {l.descoberta && (
                <Etiqueta tom="ok" title="Achado pelo modo descoberta: fora dos seus termos, barato em relação à FIPE">
                  🧭 Descoberta
                </Etiqueta>
              )}
              {l.relistado_de && (
                <Etiqueta tom="warn" title={l.lance_anterior_relist ? `Último lance visto antes: ${reais(l.lance_anterior_relist)}` : undefined}>
                  🔁 Voltou a leilão
                </Etiqueta>
              )}
              <Etiqueta tom={monta.tom}>{monta.rotulo}</Etiqueta>
              <Etiqueta tom={roda.tom}>{roda.rotulo}</Etiqueta>
              {l.circulacao === "vedada" && <Etiqueta tom="bad">Circulação vedada</Etiqueta>}
              {l.dano_estrutural && <Etiqueta tom="bad">Dano estrutural</Etiqueta>}
              {l.chave === "nao" && <Etiqueta tom="warn">Sem chave</Etiqueta>}
            </div>

            <dl className="num mt-auto grid grid-cols-3 gap-2 pt-1 text-xs sm:max-w-md">
              <div className="sm:hidden">
                <dt className="text-faint">Lance</dt>
                <dd className="text-fg">{reais(l.lance_atual)}</dd>
              </div>
              <div>
                <dt className="text-faint">Custo real</dt>
                {/* sem lance (estoque "Em breve") não há custo a calcular */}
                <dd className="text-fg">{l.lance_atual ? reais(v.custo) : "—"}</dd>
              </div>
              <div>
                <dt className="text-faint">FIPE{l.fipe_aproximada ? " ≈" : ""}</dt>
                <dd className={v.pct != null && v.pct < 0.7 ? "text-[#8fc9a1]" : "text-fg"}>
                  {/* com lance: % da FIPE; sem lance: o valor da FIPE em reais */}
                  {v.pct != null ? `${Math.round(v.pct * 100)}%` : v.fipe ? reais(v.fipe) : "—"}
                  {pctArremate != null && (
                    <span className="block text-[10px] text-faint" title="Mediana do último lance visto em leilões encerrados deste modelo">
                      fecha ~{Math.round(pctArremate * 100)}%
                    </span>
                  )}
                </dd>
              </div>
              <div className="hidden sm:block">
                <dt className="text-faint">Encerra</dt>
                <dd>
                  <Contagem fim={l.fim_em} />
                </dd>
              </div>
            </dl>

            <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
              <span className="truncate text-[11px] text-faint">
                {l.site_nome} · <span className="sm:hidden"><Contagem fim={l.fim_em} /> · </span>
                <span className="hidden sm:inline">{quando(l.fim_em)}</span>
              </span>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => marcar("gostei")}
                  aria-pressed={decisao === "gostei"}
                  className={`press rounded-md px-2 py-1 text-xs ${
                    decisao === "gostei" ? "bg-amber/15 text-amber" : "text-muted hover:bg-raised hover:text-fg"
                  }`}
                >
                  {decisao === "gostei" ? "★ Favorito" : "👍 Gostei"}
                </button>
                <button
                  onClick={() => marcar("descartado")}
                  className="press rounded-md px-2 py-1 text-xs text-muted hover:bg-bad/15 hover:text-[#e0938f]"
                >
                  Descartar
                </button>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className={
                    modo === "favoritos"
                      ? "press rounded-md bg-fg px-3 py-1 text-xs font-medium text-bg hover:bg-white"
                      : "press rounded-md px-2 py-1 text-xs text-muted hover:bg-raised hover:text-fg"
                  }
                >
                  {modo === "favoritos" ? "Ver no site ↗" : "Site ↗"}
                </a>
              </div>
            </div>
          </div>
        </article>
        {children && <div className="border-t border-line p-3">{children}</div>}
        </div>
      </div>
    </li>
  );
}
