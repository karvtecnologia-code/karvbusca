"use client";

import { useActionState } from "react";
import { corrigirFipe } from "../../lotes-actions";
import { reais } from "@/lib/lotes";

export function FipeForm(p: { loteId: string; codigo: string | null; valor: number | null; aproximada: boolean; doSite: boolean }) {
  const [estado, acao, pendente] = useActionState(
    (_: unknown, f: FormData) => corrigirFipe(p.loteId, f),
    null as { erro?: string; ok?: string } | null,
  );
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">FIPE</h2>
        <span className="num text-sm">{reais(p.valor)}</span>
      </div>
      <p className="text-xs text-muted">
        {p.valor == null
          ? "Ainda sem FIPE. O robô busca na próxima execução, ou informe o código abaixo."
          : p.doSite
            ? "Valor informado pelo próprio site."
            : p.aproximada
              ? "FIPE aproximada: o modelo não casou com certeza. Confira o código."
              : `Código ${p.codigo}.`}
      </p>
      <form action={acao} className="mt-3 flex gap-2">
        <input
          name="codigo"
          defaultValue={p.codigo ?? ""}
          placeholder="000000-0"
          aria-label="Código FIPE"
          className="press num h-8 w-full rounded-md border border-line bg-bg px-2 text-sm outline-none focus:border-amber/70"
        />
        <button
          disabled={pendente}
          className="press h-8 shrink-0 rounded-md border border-line px-3 text-xs text-muted hover:text-fg disabled:opacity-60"
        >
          {pendente ? "Consultando…" : "Corrigir"}
        </button>
      </form>
      {estado?.erro && <p className="enter mt-2 text-xs text-bad">{estado.erro}</p>}
      {estado?.ok && <p className="enter mt-2 text-xs text-[#8fc9a1]">Atualizado: {estado.ok}</p>}
      <a
        href="https://veiculos.fipe.org.br/"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-[11px] text-faint hover:text-fg"
      >
        Procurar código no site da FIPE ↗
      </a>
    </section>
  );
}
