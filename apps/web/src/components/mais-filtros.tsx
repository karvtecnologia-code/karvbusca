"use client";

import { useState } from "react";
import { CORES, contarFiltros, type FiltrosBusca } from "@karv/core";

const PROCEDENCIAS = [
  ["financiamento", "Financeira"],
  ["frota", "Frota/locadora"],
  ["patrimonio", "Patrimônio"],
  ["particular", "Particular"],
  ["judicial", "Judicial"],
  ["apreensao", "Apreensão"],
  ["seguradora", "Seguradora"],
  ["nao_informado", "Não informada"],
] as const;
const MONTAS = [
  ["sem_monta", "Sem monta"],
  ["pequena", "Pequena"],
  ["media", "Média"],
  ["nao_informado", "Não informada"],
] as const;
const COMBUSTIVEIS = ["flex", "gasolina", "etanol", "diesel", "elétrico", "híbrido"];

const num = (s: string) => {
  const t = s.replace(/\./g, "").replace(",", ".").trim();
  return t === "" || !Number.isFinite(Number(t)) ? null : Number(t);
};

/**
 * Filtros extras (ano, lance, km, FIPE, cor, procedência, monta…), guardados como JSON
 * num campo escondido `name` do formulário. Usado nos termos e no modo descoberta.
 */
export function MaisFiltros({
  name = "filtros",
  inicial,
  semAno = false,
  abertoInicial = false,
}: {
  name?: string;
  inicial?: FiltrosBusca | null;
  /** o termo já tem ano mín./máx. nos campos principais */
  semAno?: boolean;
  abertoInicial?: boolean;
}) {
  const [f, setF] = useState<FiltrosBusca>(inicial ?? {});
  const [aberto, setAberto] = useState(abertoInicial);
  const n = contarFiltros(f);

  const setNum = (k: keyof FiltrosBusca, pct = false) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = num(e.target.value);
    setF((o) => ({ ...o, [k]: v == null ? null : pct ? v / 100 : v }));
  };
  const alternar = (k: "cores" | "procedencias" | "montas" | "combustiveis", v: string) =>
    setF((o) => {
      const l = new Set(o[k] ?? []);
      if (l.has(v)) l.delete(v);
      else l.add(v);
      return { ...o, [k]: [...l] };
    });
  const val = (v: number | null | undefined, pct = false) => (v == null ? "" : String(pct ? Math.round(v * 100) : v));

  const campo =
    "press num h-10 w-full rounded-md border border-line bg-bg px-2.5 text-sm outline-none placeholder:text-faint hover:border-line-strong focus:border-amber/70 sm:h-9";
  const chip = (on: boolean) =>
    `press h-9 rounded-md border px-2.5 text-xs sm:h-8 ${on ? "border-amber/50 bg-amber/12 text-amber" : "border-line text-muted hover:text-fg"}`;
  const Num = ({ k, rotulo, ph, pct }: { k: keyof FiltrosBusca; rotulo: string; ph?: string; pct?: boolean }) => (
    <label key={k} className="block min-w-0">
      <span className="mb-1 block text-[11px] text-faint">{rotulo}</span>
      <input
        inputMode="numeric"
        defaultValue={val(f[k] as number | null, pct)}
        onBlur={setNum(k, pct)}
        placeholder={ph}
        className={campo}
      />
    </label>
  );
  const Chips = ({ k, itens, rotulo }: { k: "cores" | "procedencias" | "montas" | "combustiveis"; itens: readonly (readonly [string, string])[]; rotulo: string }) => (
    <div>
      <span className="mb-1 block text-[11px] text-faint">{rotulo}</span>
      <div className="flex flex-wrap gap-1">
        {itens.map(([v, r]) => (
          <button key={v} type="button" onClick={() => alternar(k, v)} aria-pressed={(f[k] ?? []).includes(v)} className={chip((f[k] ?? []).includes(v))}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="sm:col-span-full">
      <input type="hidden" name={name} value={JSON.stringify(f)} />
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="press inline-flex h-9 items-center gap-1.5 rounded-md px-1 text-sm text-muted hover:text-fg"
      >
        <span className={`inline-block transition-transform duration-200 ease-[var(--ease-out)] ${aberto ? "rotate-90" : ""}`}>›</span>
        Mais filtros{n ? <span className="num text-amber"> ({n})</span> : null}
      </button>
      {aberto && (
        <div className="enter mt-2 space-y-3 rounded-md border border-line bg-bg/40 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {!semAno && Num({k: "anoMin", rotulo: "Ano mín.", ph: "2015",})}
            {!semAno && Num({k: "anoMax", rotulo: "Ano máx.", ph: "2024",})}
            {Num({k: "lanceMin", rotulo: "Lance mín. R$",})}
            {Num({k: "lanceMax", rotulo: "Lance máx. R$",})}
            {Num({k: "fipeMin", rotulo: "FIPE mín. R$", ph: "30.000",})}
            {Num({k: "fipeMax", rotulo: "FIPE máx. R$", ph: "120.000",})}
            {Num({k: "pctFipeMax", rotulo: "Lance até % da FIPE", ph: "70", pct: true,})}
            {Num({k: "kmMax", rotulo: "Km máx.", ph: "120.000",})}
          </div>
          {Chips({ k: "procedencias", rotulo: "Procedência", itens: PROCEDENCIAS })}
          {Chips({ k: "montas", rotulo: "Monta", itens: MONTAS })}
          {Chips({ k: "cores", rotulo: "Cor", itens: CORES.map((c) => [c, c[0]!.toUpperCase() + c.slice(1)] as const) })}
          {Chips({ k: "combustiveis", rotulo: "Combustível", itens: COMBUSTIVEIS.map((c) => [c, c[0]!.toUpperCase() + c.slice(1)] as const) })}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.comChave} onChange={(e) => setF((o) => ({ ...o, comChave: e.target.checked || undefined }))} className="size-4 accent-[#f5a524]" />
            Esconder os que informam estar sem chave
          </label>
          <p className="text-[11px] text-faint">
            O que o site não informa (cor, km, procedência…) não barra o lote. Filtros de FIPE valem quando a FIPE é conhecida.
          </p>
          {n > 0 && (
            <button type="button" onClick={() => setF({})} className="press text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
              Limpar estes filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
