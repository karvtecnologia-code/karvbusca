"use client";

import { useEffect, useRef, useState } from "react";

export interface Opcao {
  valor: string;
  rotulo: string;
}

/**
 * Menu suspenso que aceita um ou vários itens. `selecionados` vazio = "Todos".
 * Fecha ao clicar fora ou com Esc.
 */
export function MultiSel(p: {
  rotulo: string;
  opcoes: Opcao[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  classe: string;
  colunas?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const sel = new Set(p.selecionados);
  const alternar = (v: string) => {
    const n = new Set(sel);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    p.onChange([...n]);
  };
  const resumo =
    sel.size === 0
      ? "Todos"
      : sel.size <= 2
        ? p.opcoes.filter((o) => sel.has(o.valor)).map((o) => o.rotulo).join(", ")
        : `${sel.size} selecionados`;

  return (
    <div ref={ref} className="relative block space-y-1">
      <span className="text-[11px] text-faint">{p.rotulo}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className={`${p.classe} flex items-center justify-between gap-1 text-left`}
      >
        <span className={`truncate ${sel.size ? "text-fg" : "text-muted"}`}>{resumo}</span>
        <span className={`text-[10px] text-faint transition-transform duration-150 ${aberto ? "rotate-180" : ""}`}>▼</span>
      </button>
      {aberto && (
        <div
          role="listbox"
          aria-multiselectable
          className="enter absolute left-0 z-40 mt-1 max-h-72 w-max min-w-full overflow-y-auto rounded-md border border-line-strong bg-raised p-1 shadow-xl"
        >
          <div className="mb-1 flex gap-1 border-b border-line pb-1">
            <button type="button" onClick={() => p.onChange([])} className="press rounded px-2 py-1 text-xs text-muted hover:bg-bg hover:text-fg">
              Todos
            </button>
            {sel.size > 0 && (
              <button type="button" onClick={() => p.onChange([])} className="press rounded px-2 py-1 text-xs text-muted hover:bg-bg hover:text-fg">
                Limpar
              </button>
            )}
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${p.colunas ?? 1}, minmax(0, 1fr))` }}>
            {p.opcoes.map((o) => (
              <label
                key={o.valor}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-bg"
              >
                <input
                  type="checkbox"
                  checked={sel.has(o.valor)}
                  onChange={() => alternar(o.valor)}
                  className="size-3.5 accent-[#f5a524]"
                />
                <span className="whitespace-nowrap">{o.rotulo}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
