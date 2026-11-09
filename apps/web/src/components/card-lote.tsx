"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { PadroesCusto } from "@karv/core";
import { decidir } from "@/app/(painel)/lotes-actions";
import { anosFmt, kmFmt, MONTA, quando, reais, RODA, valoresLote, type LotePainel } from "@/lib/lotes";
import { Contagem } from "./contagem";
import { Etiqueta } from "./etiqueta";

export function CardLote({
  lote: l,
  padroes,
  indice = 0,
  novo = false,
}: {
  lote: LotePainel;
  padroes: PadroesCusto;
  indice?: number;
  novo?: boolean;
}) {
  const [decisao, setDecisao] = useState(l.decisao);
  const [saindo, setSaindo] = useState(false);
  const [, start] = useTransition();
  const v = valoresLote(l, padroes);
  const monta = MONTA[l.condicao_monta] ?? MONTA.nao_informado!;
  const roda = RODA[l.roda] ?? RODA.nao_informado!;
  const local = [l.cidade, l.uf].filter(Boolean).join("-");
  const linha = [anosFmt(l.ano_fab, l.ano_mod), kmFmt(l.km), local].filter(Boolean).join(" · ");

  const marcar = (d: "gostei" | "descartado") => {
    const nova = decisao === d ? null : d;
    if (nova === "descartado") setSaindo(true); // sai da lista com animação
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
        <article className="group mb-3 flex gap-3 rounded-lg border border-line bg-surface p-2.5 transition-colors duration-150 hover:border-line-strong sm:gap-4 sm:p-3">
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
              <div className="hidden shrink-0 text-right sm:block">
                <div className="num text-base font-medium">{reais(l.lance_atual)}</div>
                <div className="text-[11px] text-faint">lance atual</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
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
                <dd className="text-fg">{reais(v.custo)}</dd>
              </div>
              <div>
                <dt className="text-faint">FIPE{l.fipe_aproximada ? " ≈" : ""}</dt>
                <dd className={v.pct != null && v.pct < 0.7 ? "text-[#8fc9a1]" : "text-fg"}>
                  {v.pct != null ? `${Math.round(v.pct * 100)}%` : "—"}
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
                  className="press rounded-md px-2 py-1 text-xs text-muted hover:bg-raised hover:text-fg"
                >
                  Site ↗
                </a>
              </div>
            </div>
          </div>
        </article>
      </div>
    </li>
  );
}
