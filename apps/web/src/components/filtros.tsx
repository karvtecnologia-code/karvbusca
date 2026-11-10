"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

interface Opcao {
  valor: string;
  rotulo: string;
}

const MONTAS: Opcao[] = [
  { valor: "sem_monta", rotulo: "Sem monta" },
  { valor: "pequena", rotulo: "Pequena" },
  { valor: "media", rotulo: "Média" },
  { valor: "grande", rotulo: "Grande" },
  { valor: "sucata", rotulo: "Sucata" },
  { valor: "nao_informado", rotulo: "Não inf." },
];

export function Filtros({
  sites,
  termos,
  total,
  ufs = ["SP", "MG"],
}: {
  sites: Opcao[];
  termos: Opcao[];
  total: number;
  ufs?: string[];
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const [pendente, start] = useTransition();

  const set = (chave: string, valor: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (valor == null || valor === "") p.delete(chave);
    else p.set(chave, valor);
    start(() => router.replace(`${path}?${p}`, { scroll: false }));
  };
  const val = (k: string) => sp.get(k) ?? "";
  const montas = (sp.get("monta") ?? "").split(",").filter(Boolean);
  const alternarMonta = (m: string) => {
    const nova = montas.includes(m) ? montas.filter((x) => x !== m) : [...montas, m];
    set("monta", nova.join(","));
  };
  const apto = sp.get("apto") !== "0";
  const ativos = [...sp.keys()].filter((k) => k !== "ordem").length;

  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  const campo =
    "press h-8 w-full rounded-md border border-line bg-bg px-2 text-sm outline-none hover:border-line-strong focus:border-amber/70";
  const chip = (on: boolean) =>
    `press h-7 rounded-md border px-2 text-xs ${on ? "border-amber/50 bg-amber/12 text-amber" : "border-line text-muted hover:text-fg"}`;

  const painel = (
    <div className="space-y-4">
      <Busca valor={val("q")} onChange={(v) => set("q", v.trim() || null)} classe={campo} />
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-bg px-3 py-2">
        <span>
          <span className="block text-sm">Só aptos a rodar</span>
          <span className="block text-[11px] text-faint">sem sucata/grande monta, motor ok, sem dano estrutural</span>
        </span>
        <input
          type="checkbox"
          checked={apto}
          onChange={(e) => set("apto", e.target.checked ? null : "0")}
          className="size-4 accent-[#f5a524]"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Sel rotulo="Site" valor={val("site")} onChange={(v) => set("site", v)} opcoes={sites} classe={campo} />
        <Sel rotulo="Termo" valor={val("termo")} onChange={(v) => set("termo", v)} opcoes={termos} classe={campo} />
        <Sel
          rotulo="UF"
          valor={val("uf")}
          onChange={(v) => set("uf", v)}
          opcoes={ufs.map((u) => ({ valor: u, rotulo: u }))}
          classe={campo}
        />
        <Sel
          rotulo="Motor"
          valor={val("roda")}
          onChange={(v) => set("roda", v)}
          opcoes={[
            { valor: "sim", rotulo: "Funciona" },
            { valor: "nao_informado", rotulo: "Não informado" },
            { valor: "nao", rotulo: "Não funciona" },
          ]}
          classe={campo}
        />
        <Sel
          rotulo="Chave"
          valor={val("chave")}
          onChange={(v) => set("chave", v)}
          opcoes={[
            { valor: "sim", rotulo: "Com chave" },
            { valor: "nao", rotulo: "Sem chave" },
          ]}
          classe={campo}
        />
        <Sel
          rotulo="Tipo"
          valor={val("tipo")}
          onChange={(v) => set("tipo", v)}
          opcoes={[
            { valor: "carro", rotulo: "Carros" },
            { valor: "moto", rotulo: "Motos" },
          ]}
          classe={campo}
        />
      </div>

      <div>
        <span className="mb-1.5 block text-[11px] text-faint">Monta</span>
        <div className="flex flex-wrap gap-1">
          {MONTAS.map((m) => (
            <button key={m.valor} onClick={() => alternarMonta(m.valor)} className={chip(montas.includes(m.valor))}>
              {m.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Num rotulo="Ano mín." valor={val("ano")} onChange={(v) => set("ano", v)} classe={campo} />
        <Num rotulo="Km máx." valor={val("km")} onChange={(v) => set("km", v)} classe={campo} />
        <Num rotulo="Lance máx." valor={val("lance")} onChange={(v) => set("lance", v)} classe={campo} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Sel
          rotulo="Distância de você"
          valor={val("raio")}
          onChange={(v) => set("raio", v)}
          opcoes={[
            { valor: "150", rotulo: "até 150 km" },
            { valor: "300", rotulo: "até 300 km" },
            { valor: "500", rotulo: "até 500 km" },
            { valor: "800", rotulo: "até 800 km" },
          ]}
          classe={campo}
        />
        <Sel
          rotulo="Nota mínima"
          valor={val("nmin")}
          onChange={(v) => set("nmin", v)}
          opcoes={[
            { valor: "75", rotulo: "🔥 75+" },
            { valor: "60", rotulo: "60+" },
            { valor: "45", rotulo: "45+" },
          ]}
          classe={campo}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        <button onClick={() => set("desc", val("desc") ? null : "1")} className={chip(!!val("desc"))}>
          🧭 Só descobertas
        </button>
        <button onClick={() => set("h24", val("h24") ? null : "1")} className={chip(!!val("h24"))}>
          Encerra em 24h
        </button>
        <button onClick={() => set("fipe", val("fipe") ? null : "1")} className={chip(!!val("fipe"))}>
          Abaixo de 70% FIPE
        </button>
        <button onClick={() => set("breve", val("breve") ? null : "1")} className={chip(!!val("breve"))}>
          Esconder “Em breve”
        </button>
      </div>

      {ativos > 0 && (
        <button onClick={() => start(() => router.replace(path))} className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
          Limpar filtros
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="num text-sm text-muted">
          <span className={`text-fg transition-opacity duration-150 ${pendente ? "opacity-50" : ""}`}>{total}</span> lotes
        </p>
        <div className="flex items-center gap-2">
          <select
            aria-label="Ordenar"
            value={val("ordem") || "nota"}
            onChange={(e) => set("ordem", e.target.value === "nota" ? null : e.target.value)}
            className="press h-8 rounded-md border border-line bg-surface px-2 text-sm outline-none hover:border-line-strong"
          >
            <option value="nota">Melhor nota</option>
            <option value="fim">Encerra antes</option>
            <option value="fipe">Menor % FIPE</option>
            <option value="lance">Menor lance</option>
            <option value="novos">Mais novos</option>
          </select>
          <button
            onClick={() => setAberto(true)}
            className="press h-8 rounded-md border border-line bg-surface px-3 text-sm lg:hidden"
          >
            Filtros{ativos ? <span className="num ml-1 text-amber">{ativos}</span> : null}
          </button>
        </div>
      </div>

      {/* desktop: barra lateral fixa */}
      <aside className="hidden lg:block">{painel}</aside>

      {/* celular: gaveta que sobe de baixo */}
      <div
        className={`fixed inset-0 z-30 lg:hidden ${aberto ? "" : "pointer-events-none"}`}
        aria-hidden={!aberto}
      >
        <div
          onClick={() => setAberto(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${aberto ? "opacity-100" : "opacity-0"}`}
        />
        <div
          role="dialog"
          aria-label="Filtros"
          className={`absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-line bg-surface p-4 pb-8 transition-transform duration-[250ms] ease-[var(--ease-out)] ${
            aberto ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
          {painel}
          <button
            onClick={() => setAberto(false)}
            className="press mt-5 h-10 w-full rounded-md bg-fg text-sm font-medium text-bg"
          >
            Ver {total} lotes
          </button>
        </div>
      </div>
    </>
  );
}

function Sel(p: { rotulo: string; valor: string; onChange: (v: string) => void; opcoes: Opcao[]; classe: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-faint">{p.rotulo}</span>
      <select value={p.valor} onChange={(e) => p.onChange(e.target.value)} className={p.classe}>
        <option value="">Todos</option>
        {p.opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

function Busca(p: { valor: string; onChange: (v: string) => void; classe: string }) {
  const [v, setV] = useState(p.valor);
  useEffect(() => setV(p.valor), [p.valor]);
  // aplica 400 ms depois de parar de digitar
  useEffect(() => {
    if (v === p.valor) return;
    const t = setTimeout(() => p.onChange(v), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <label className="block">
      <span className="sr-only">Buscar</span>
      <input
        type="search"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Buscar: hr-v 2017, bros, asx…"
        className={`${p.classe} h-9`}
      />
    </label>
  );
}

function Num(p: { rotulo: string; valor: string; onChange: (v: string) => void; classe: string }) {
  const [v, setV] = useState(p.valor);
  useEffect(() => setV(p.valor), [p.valor]);
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-faint">{p.rotulo}</span>
      <input
        inputMode="numeric"
        value={v}
        onChange={(e) => setV(e.target.value.replace(/\D/g, ""))}
        onBlur={() => v !== p.valor && p.onChange(v)}
        onKeyDown={(e) => e.key === "Enter" && p.onChange(v)}
        className={`${p.classe} num`}
      />
    </label>
  );
}
