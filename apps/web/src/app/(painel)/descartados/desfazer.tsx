"use client";

import { useTransition } from "react";
import { decidir } from "../lotes-actions";

export function Desfazer({ loteId }: { loteId: string }) {
  const [pendente, start] = useTransition();
  return (
    <button
      disabled={pendente}
      onClick={() => start(() => decidir(loteId, null))}
      className="press shrink-0 rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-fg disabled:opacity-60"
    >
      {pendente ? "…" : "Desfazer"}
    </button>
  );
}
