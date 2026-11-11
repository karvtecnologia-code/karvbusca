"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";
import { decidirVarios } from "@/app/(painel)/lotes-actions";

type Ctx = { ativo: boolean; marcado: (id: string) => boolean; alternar: (id: string) => void };
const SelecaoCtx = createContext<Ctx | null>(null);
export const useSelecao = () => useContext(SelecaoCtx);

/**
 * Seleção múltipla: botão "Selecionar" → marca os cards → barra embaixo com as ações.
 * "lotes": favoritar ou descartar; "favoritos": tirar dos favoritos ou descartar.
 */
export function Selecao({ ids, modo, children }: { ids: string[]; modo: "lotes" | "favoritos"; children: React.ReactNode }) {
  const [ativo, setAtivo] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pendente, start] = useTransition();
  const router = useRouter();
  const validos = [...sel].filter((id) => ids.includes(id));
  const todos = ids.length > 0 && validos.length === ids.length;

  const sair = () => {
    setAtivo(false);
    setSel(new Set());
  };
  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const aplicar = (d: "gostei" | "descartado" | null) =>
    start(async () => {
      await decidirVarios(validos, d);
      sair();
      router.refresh();
    });

  const botao = "press inline-flex h-10 items-center rounded-md px-3 text-sm sm:h-9";
  return (
    <SelecaoCtx.Provider value={{ ativo, marcado: (id) => sel.has(id), alternar }}>
      <div className="mb-3 flex items-center justify-end gap-2">
        {ativo ? (
          <>
            <button onClick={() => setSel(todos ? new Set() : new Set(ids))} className={`${botao} border border-line text-muted hover:text-fg`}>
              {todos ? "Limpar seleção" : `Selecionar todos (${ids.length})`}
            </button>
            <button onClick={sair} className={`${botao} text-muted hover:text-fg`}>
              Cancelar
            </button>
          </>
        ) : (
          ids.length > 0 && (
            <button onClick={() => setAtivo(true)} className={`${botao} border border-line text-muted hover:text-fg`}>
              Selecionar
            </button>
          )
        )}
      </div>
      {children}
      {/* barra de ações: acima da barra de abas no celular */}
      {ativo && validos.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-3 pb-3 sm:bottom-0 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="enter mx-auto flex max-w-xl items-center gap-2 rounded-xl border border-line-strong bg-raised p-2 shadow-2xl">
            <span className="num px-2 text-sm">
              <span className="text-amber">{validos.length}</span> <span className="text-muted">selecionado{validos.length > 1 ? "s" : ""}</span>
            </span>
            <div className={`ml-auto flex gap-1.5 ${pendente ? "pointer-events-none opacity-50" : ""}`}>
              {modo === "lotes" ? (
                <button onClick={() => aplicar("gostei")} className={`${botao} bg-amber/15 text-amber`}>
                  Favoritar
                </button>
              ) : (
                <button onClick={() => aplicar(null)} className={`${botao} border border-line text-fg`}>
                  Tirar dos favoritos
                </button>
              )}
              <button onClick={() => aplicar("descartado")} className={`${botao} bg-bad/20 text-[#e0938f]`}>
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </SelecaoCtx.Provider>
  );
}
