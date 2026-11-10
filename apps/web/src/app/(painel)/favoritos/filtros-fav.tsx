"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function FiltrosFav({ sites, total }: { sites: { valor: string; rotulo: string }[]; total: number }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pendente, start] = useTransition();
  const [busca, setBusca] = useState(sp.get("q") ?? "");

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (!v) p.delete(k);
    else p.set(k, v);
    start(() => router.replace(`${path}?${p}`, { scroll: false }));
  };
  useEffect(() => {
    if (busca === (sp.get("q") ?? "")) return;
    const t = setTimeout(() => set("q", busca.trim() || null), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const campo =
    "press h-9 rounded-md border border-line bg-surface px-2.5 text-sm outline-none hover:border-line-strong focus:border-amber/70";
  const chip = (on: boolean) =>
    `press h-9 rounded-md border px-3 text-sm ${on ? "border-amber/50 bg-amber/12 text-amber" : "border-line text-muted hover:text-fg"}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar nos favoritos…"
        className={`${campo} w-full sm:w-56`}
      />
      <select aria-label="Site" value={sp.get("site") ?? ""} onChange={(e) => set("site", e.target.value)} className={campo}>
        <option value="">Todos os sites</option>
        {sites.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.rotulo}
          </option>
        ))}
      </select>
      <select aria-label="Ordenar" value={sp.get("ordem") ?? "fim"} onChange={(e) => set("ordem", e.target.value === "fim" ? null : e.target.value)} className={campo}>
        <option value="fim">Encerra antes ↑</option>
        <option value="fim_desc">Encerra depois ↓</option>
        <option value="fipe">Menor % FIPE</option>
        <option value="lance">Menor lance</option>
      </select>
      <button onClick={() => set("h24", sp.get("h24") ? null : "1")} className={chip(!!sp.get("h24"))}>
        Encerra em 24h
      </button>
      <span className={`num ml-auto text-sm text-muted transition-opacity ${pendente ? "opacity-50" : ""}`}>
        <span className="text-fg">{total}</span> favoritos
      </span>
    </div>
  );
}
