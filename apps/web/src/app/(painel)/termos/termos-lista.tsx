"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { alternarTermo, removerTermo, salvarTermo } from "./actions";

export interface TermoRow {
  id: string;
  termo: string;
  apelidos: string[];
  tipo: "carro" | "moto" | null;
  ano_min: number | null;
  ano_max: number | null;
  lance_max: number | null;
  ativo: boolean;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function TermosLista({ termos }: { termos: TermoRow[] }) {
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <FormTermo key="novo" />
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {termos.length === 0 && <li className="px-4 py-6 text-sm text-muted">Nenhum termo cadastrado.</li>}
        {termos.map((t, i) => (
          <li key={t.id} className="enter" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
            {editando === t.id ? (
              <div className="p-3">
                <FormTermo termo={t} onFim={() => setEditando(null)} />
              </div>
            ) : (
              <Linha termo={t} onEditar={() => setEditando(t.id)} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Linha({ termo: t, onEditar }: { termo: TermoRow; onEditar: () => void }) {
  const [ativo, setAtivo] = useOptimistic(t.ativo);
  const [, start] = useTransition();
  const [saindo, setSaindo] = useState(false);

  const filtros = [
    t.tipo,
    t.ano_min || t.ano_max ? `${t.ano_min ?? "…"}–${t.ano_max ?? "…"}` : null,
    t.lance_max ? `até ${brl.format(t.lance_max)}` : null,
  ].filter(Boolean);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-[opacity,transform] duration-200 ease-[var(--ease-out)] ${
        saindo ? "-translate-x-2 opacity-0" : ""
      } ${ativo ? "" : "opacity-55"}`}
    >
      <button
        role="switch"
        aria-checked={ativo}
        aria-label={ativo ? `Desligar ${t.termo}` : `Ligar ${t.termo}`}
        onClick={() =>
          start(async () => {
            setAtivo(!ativo);
            await alternarTermo(t.id, !ativo);
          })
        }
        className={`press relative h-5 w-9 shrink-0 rounded-full border ${
          ativo ? "border-amber/60 bg-amber/25" : "border-line-strong bg-raised"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-3.5 rounded-full transition-transform duration-200 ease-[var(--ease-out)] ${
            ativo ? "translate-x-4 bg-amber" : "bg-muted"
          }`}
        />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="num text-sm font-medium">{t.termo}</span>
          {t.apelidos.length > 0 && (
            <span className="truncate text-xs text-faint">{t.apelidos.join(" · ")}</span>
          )}
        </div>
        {filtros.length > 0 && <div className="num mt-0.5 text-xs text-muted">{filtros.join("  ·  ")}</div>}
      </div>

      <button onClick={onEditar} className="press rounded px-2 py-1 text-xs text-muted hover:bg-raised hover:text-fg">
        Editar
      </button>
      <button
        onClick={() => {
          if (!window.confirm(`Remover "${t.termo}"?`)) return;
          setSaindo(true);
          start(() => removerTermo(t.id));
        }}
        className="press rounded px-2 py-1 text-xs text-muted hover:bg-bad/15 hover:text-bad"
      >
        Remover
      </button>
    </div>
  );
}

function FormTermo({ termo, onFim }: { termo?: TermoRow; onFim?: () => void }) {
  const [estado, acao, pendente] = useActionState(salvarTermo, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) {
      if (termo) onFim?.();
      else ref.current?.reset();
    }
  }, [estado, termo, onFim]);

  const input =
    "press h-9 w-full rounded-md border border-line bg-bg px-2.5 text-sm outline-none placeholder:text-faint hover:border-line-strong focus:border-amber/70";

  return (
    <form
      ref={ref}
      action={acao}
      className={`grid gap-2 sm:grid-cols-[1.2fr_1.5fr_0.8fr_0.7fr_0.7fr_1fr_auto] ${
        termo ? "" : "rounded-lg border border-line bg-surface p-3"
      }`}
    >
      {termo && <input type="hidden" name="id" value={termo.id} />}
      <input name="termo" placeholder="Modelo (ex.: hrv)" defaultValue={termo?.termo} required className={input} aria-label="Modelo" />
      <input name="apelidos" placeholder="Apelidos, separados por vírgula" defaultValue={termo?.apelidos.join(", ")} className={input} aria-label="Apelidos" />
      <select name="tipo" defaultValue={termo?.tipo ?? ""} className={input} aria-label="Tipo">
        <option value="">Tipo</option>
        <option value="carro">Carro</option>
        <option value="moto">Moto</option>
      </select>
      <input name="ano_min" inputMode="numeric" placeholder="Ano mín." defaultValue={termo?.ano_min ?? ""} className={`${input} num`} aria-label="Ano mínimo" />
      <input name="ano_max" inputMode="numeric" placeholder="Ano máx." defaultValue={termo?.ano_max ?? ""} className={`${input} num`} aria-label="Ano máximo" />
      <input name="lance_max" inputMode="numeric" placeholder="Lance máx. R$" defaultValue={termo?.lance_max ?? ""} className={`${input} num`} aria-label="Lance máximo" />
      <div className="flex gap-2">
        {termo && (
          <button type="button" onClick={onFim} className="press h-9 rounded-md px-3 text-sm text-muted hover:text-fg">
            Cancelar
          </button>
        )}
        <button
          disabled={pendente}
          className="press h-9 rounded-md bg-amber px-4 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-60"
        >
          {pendente ? "Salvando…" : termo ? "Salvar" : "Adicionar"}
        </button>
      </div>
      {estado?.erro && <p className="enter text-sm text-bad sm:col-span-full">{estado.erro}</p>}
    </form>
  );
}
