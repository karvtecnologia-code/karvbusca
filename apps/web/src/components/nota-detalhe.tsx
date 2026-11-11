"use client";

import { useState } from "react";
import type { ItemNota } from "@karv/core";
import { corNota } from "@/lib/lotes";

/** Selo da nota; ao passar o mouse (ou tocar) abre a tabela com a pontuação de cada critério. */
export function NotaDetalhe({
  nota,
  itens,
  teto,
  quente,
}: {
  nota: number;
  itens: ItemNota[];
  teto: number | null;
  quente: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const soma = itens.reduce((s, i) => s + i.pontos, 0);
  return (
    <div className="group/nota relative" onMouseLeave={() => setAberto(false)}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className={`num grid size-11 shrink-0 place-items-center rounded-lg border text-center leading-none ${corNota(nota)}`}
      >
        <span className="text-base font-semibold">{nota}</span>
        <span className="text-[9px] opacity-70">{quente ? "🔥 nota" : "nota"}</span>
      </button>
      <div
        role="tooltip"
        className={`absolute top-12 right-0 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line-strong bg-raised p-3 text-left text-xs shadow-xl ${
          aberto ? "block" : "hidden group-hover/nota:block"
        }`}
      >
        <p className="mb-2 font-medium text-fg">Nota de oportunidade</p>
        <table className="num w-full">
          <thead>
            <tr className="text-faint">
              <th className="pb-1 text-left font-normal">Critério</th>
              <th className="pb-1 text-right font-normal">Pontos</th>
              <th className="pb-1 text-right font-normal">Máx.</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.criterio} className="border-t border-line align-top">
                <td className="py-1 pr-2">
                  <span className="text-fg">{i.criterio}</span>
                  <span className="block text-[10px] text-faint">{i.detalhe}</span>
                </td>
                <td className={`py-1 text-right ${i.pontos >= i.max ? "text-[#8fc9a1]" : i.pontos <= 0 ? "text-[#e0938f]" : "text-fg"}`}>
                  {Number.isInteger(i.pontos) ? i.pontos : i.pontos.toFixed(1)}
                </td>
                <td className="py-1 text-right text-faint">{i.max}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong font-medium">
              <td className="pt-1.5">Total</td>
              <td className="pt-1.5 text-right">{nota}</td>
              <td className="pt-1.5 text-right text-faint">100</td>
            </tr>
          </tfoot>
        </table>
        {teto != null && (
          <p className="mt-2 text-[#e0938f]">Dano estrutural: nota limitada a {teto} (soma seria {Math.round(soma)}).</p>
        )}
        <p className="mt-2 text-[10px] text-faint">Recalculada com o lance atual: muda conforme o preço sobe.</p>
      </div>
    </div>
  );
}
