"use client";

import { useState } from "react";

export function Galeria({ fotos }: { fotos: string[] }) {
  const [i, setI] = useState(0);
  if (!fotos.length)
    return <div className="grid aspect-[4/3] place-items-center rounded-lg border border-line bg-surface text-sm text-faint">sem fotos</div>;
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border border-line bg-raised">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={fotos[i]} src={fotos[i]} alt="" className="enter aspect-[4/3] w-full object-cover" />
        {fotos.length > 1 && (
          <>
            <button
              aria-label="Foto anterior"
              onClick={() => setI((i - 1 + fotos.length) % fotos.length)}
              className="press absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-bg/70 text-fg backdrop-blur hover:bg-bg"
            >
              ‹
            </button>
            <button
              aria-label="Próxima foto"
              onClick={() => setI((i + 1) % fotos.length)}
              className="press absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-bg/70 text-fg backdrop-blur hover:bg-bg"
            >
              ›
            </button>
            <span className="num absolute right-2 bottom-2 rounded bg-bg/70 px-1.5 py-0.5 text-[11px] backdrop-blur">
              {i + 1}/{fotos.length}
            </span>
          </>
        )}
      </div>
      {fotos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {fotos.map((f, j) => (
            <button
              key={f}
              onClick={() => setI(j)}
              className={`press shrink-0 overflow-hidden rounded border ${j === i ? "border-amber" : "border-line opacity-60 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f} alt="" loading="lazy" className="h-12 w-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
