"use client";

import { useActionState } from "react";
import { entrar } from "./actions";

export default function LoginPage() {
  const [erro, acao, pendente] = useActionState(entrar, null);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form action={acao} className="enter w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber" aria-hidden />
            <h1 className="text-lg font-semibold tracking-tight">KarvBusca</h1>
          </div>
          <p className="text-sm text-muted">Entre para ver os lotes monitorados.</p>
        </div>

        <div className="space-y-3">
          <Campo label="E-mail" name="email" type="email" autoComplete="email" />
          <Campo label="Senha" name="senha" type="password" autoComplete="current-password" />
        </div>

        {erro && (
          <p role="alert" className="enter text-sm text-bad">
            {erro}
          </p>
        )}

        <button
          disabled={pendente}
          className="press h-10 w-full rounded-md bg-fg text-sm font-medium text-bg hover:bg-white disabled:opacity-60"
        >
          {pendente ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

function Campo(props: { label: string; name: string; type: string; autoComplete: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-muted">{props.label}</span>
      <input
        name={props.name}
        type={props.type}
        autoComplete={props.autoComplete}
        required
        className="press h-10 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint hover:border-line-strong focus:border-amber/70"
      />
    </label>
  );
}
