"use client";

import { useState, useTransition } from "react";
import { salvarNota } from "../lotes-actions";

export function NotaFavorito({ loteId, nota }: { loteId: string; nota: string | null }) {
  const [v, setV] = useState(nota ?? "");
  const [salvo, setSalvo] = useState(false);
  const [pendente, start] = useTransition();
  return (
    <label className="block space-y-1">
      <span className="flex justify-between text-[11px] text-faint">
        Nota pessoal <span>{pendente ? "salvando…" : salvo ? "salvo" : ""}</span>
      </span>
      <textarea
        rows={2}
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setSalvo(false);
        }}
        onBlur={() =>
          v !== (nota ?? "") &&
          start(async () => {
            await salvarNota(loteId, v);
            setSalvo(true);
          })
        }
        placeholder="ex.: lance máx. 40 mil, ver pneus"
        className="press w-full resize-none rounded-md border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-amber/70"
      />
    </label>
  );
}
