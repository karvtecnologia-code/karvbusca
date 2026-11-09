"use client";

import { useActionState } from "react";
import { salvarPadroes, salvarSite } from "./actions";

const campo =
  "press num h-9 w-full rounded-md border border-line bg-bg px-2 text-sm outline-none hover:border-line-strong focus:border-amber/70";

function Status({ estado, pendente }: { estado: { ok?: boolean; erro?: string } | null; pendente: boolean }) {
  if (pendente) return <span className="text-xs text-faint">salvando…</span>;
  if (estado?.erro) return <span className="enter text-xs text-bad">{estado.erro}</span>;
  if (estado?.ok) return <span className="enter text-xs text-[#8fc9a1]">salvo</span>;
  return null;
}

export function FormPadroes(p: { doc: number; patio: number; frete: number | null }) {
  const [estado, acao, pendente] = useActionState(salvarPadroes, null);
  return (
    <form action={acao} className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-3">
      <label className="space-y-1">
        <span className="text-[11px] text-faint">Documentação (R$)</span>
        <input name="doc" inputMode="decimal" defaultValue={p.doc} className={campo} />
      </label>
      <label className="space-y-1">
        <span className="text-[11px] text-faint">Pátio (R$)</span>
        <input name="patio" inputMode="decimal" defaultValue={p.patio} className={campo} />
      </label>
      <label className="space-y-1">
        <span className="text-[11px] text-faint">Frete padrão (R$)</span>
        <input name="frete" inputMode="decimal" defaultValue={p.frete ?? ""} placeholder="0" className={campo} />
      </label>
      <div className="flex items-center justify-end gap-3 sm:col-span-3">
        <Status estado={estado} pendente={pendente} />
        <button disabled={pendente} className="press h-9 rounded-md bg-amber px-4 text-sm font-medium text-bg hover:brightness-110">
          Salvar
        </button>
      </div>
    </form>
  );
}

export function FormSite({ site: s }: { site: { id: number; nome: string; comissao_pct: number; taxa_adm: number; ativo: boolean } }) {
  const [estado, acao, pendente] = useActionState(salvarSite, null);
  return (
    <form action={acao} className="grid grid-cols-[1fr_88px_100px] items-end gap-2 sm:grid-cols-[1fr_96px_110px_auto]">
      <input type="hidden" name="id" value={s.id} />
      <label className="flex items-center gap-2 self-center text-sm">
        <input type="checkbox" name="ativo" defaultChecked={s.ativo} className="size-4 accent-[#f5a524]" />
        {s.nome}
      </label>
      <label className="space-y-1">
        <span className="text-[11px] text-faint">Comissão %</span>
        <input name="comissao" inputMode="decimal" defaultValue={s.comissao_pct} className={campo} />
      </label>
      <label className="space-y-1">
        <span className="text-[11px] text-faint">Taxa adm. R$</span>
        <input name="taxa" inputMode="decimal" defaultValue={s.taxa_adm} className={campo} />
      </label>
      <div className="col-span-3 flex items-center justify-end gap-2 sm:col-span-1">
        <Status estado={estado} pendente={pendente} />
        <button disabled={pendente} className="press h-9 rounded-md border border-line px-3 text-xs text-muted hover:text-fg">
          Salvar
        </button>
      </div>
    </form>
  );
}
