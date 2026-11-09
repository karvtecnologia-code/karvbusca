"use client";

import { useState, useTransition } from "react";
import { decidir, salvarNota } from "../../lotes-actions";

export function Decisao(p: { loteId: string; url: string; decisao: "gostei" | "descartado" | null; nota: string | null }) {
  const [decisao, setDecisao] = useState(p.decisao);
  const [nota, setNota] = useState(p.nota ?? "");
  const [salvo, setSalvo] = useState(false);
  const [pendente, start] = useTransition();

  const marcar = (d: "gostei" | "descartado") => {
    const nova = decisao === d ? null : d;
    setDecisao(nova);
    start(() => decidir(p.loteId, nova));
  };

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <div className="flex gap-1.5">
        <button
          onClick={() => marcar("gostei")}
          aria-pressed={decisao === "gostei"}
          className={`press h-9 rounded-md border px-3 text-sm ${
            decisao === "gostei" ? "border-amber/50 bg-amber/12 text-amber" : "border-line text-muted hover:text-fg"
          }`}
        >
          {decisao === "gostei" ? "★ Favorito" : "👍 Gostei"}
        </button>
        <button
          onClick={() => marcar("descartado")}
          aria-pressed={decisao === "descartado"}
          className={`press h-9 rounded-md border px-3 text-sm ${
            decisao === "descartado" ? "border-bad/50 bg-bad/12 text-[#e0938f]" : "border-line text-muted hover:text-fg"
          }`}
        >
          {decisao === "descartado" ? "Descartado · desfazer" : "Descartar"}
        </button>
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="press grid h-9 place-items-center rounded-md bg-fg px-3 text-sm font-medium text-bg hover:bg-white"
        >
          Ver no site ↗
        </a>
      </div>
      {decisao === "gostei" && (
        <div className="enter flex gap-1.5">
          <input
            value={nota}
            onChange={(e) => {
              setNota(e.target.value);
              setSalvo(false);
            }}
            onBlur={() => start(async () => { await salvarNota(p.loteId, nota); setSalvo(true); })}
            placeholder="Nota pessoal (ex.: lance máx. 40 mil)"
            className="press h-8 w-full rounded-md border border-line bg-bg px-2 text-sm outline-none focus:border-amber/70 sm:w-72"
          />
          <span className="w-12 self-center text-[11px] text-faint">{pendente ? "…" : salvo ? "salvo" : ""}</span>
        </div>
      )}
    </div>
  );
}
