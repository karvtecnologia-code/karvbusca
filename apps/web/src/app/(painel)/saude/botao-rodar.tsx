"use client";

import { useActionState } from "react";
import { rodarAgora } from "./actions";

export function BotaoRodar({ site, compacto }: { site?: string; compacto?: boolean }) {
  const [estado, acao, pendente] = useActionState(rodarAgora, null);
  const texto = pendente ? "Disparando…" : estado?.ok ? "Na fila ✓" : compacto ? "Rodar" : "Rodar agora";

  return (
    <form action={acao} className="flex flex-col items-end gap-1">
      <input type="hidden" name="site" value={site ?? ""} />
      <button
        disabled={pendente || estado?.ok}
        title={site ? `Rodar só ${site}` : "Rodar todos os sites"}
        className={`press rounded-md text-sm disabled:opacity-60 ${
          compacto
            ? "border border-line px-2 py-0.5 text-xs text-muted hover:border-line-strong hover:text-fg"
            : "bg-amber px-3.5 py-1.5 font-medium text-bg hover:brightness-110"
        }`}
      >
        {texto}
      </button>
      {estado?.erro && <span className="enter max-w-64 text-right text-xs text-bad">{estado.erro}</span>}
      {estado?.ok && !compacto && (
        <span className="enter text-xs text-muted">Leva ~1 min para começar. Atualize esta página depois.</span>
      )}
    </form>
  );
}
