"use client";

import { useMemo, useRef, useState } from "react";

interface Ponto {
  t: string; // ISO
  v: number;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const curto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const diaHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const W = 640;
const H = 200;
const M = { t: 12, r: 72, b: 24, l: 8 };

/**
 * Histórico do lance (linha em degraus: o lance muda aos saltos) com a FIPE como
 * referência tracejada. Uma série só: o título nomeia, a FIPE tem rótulo direto.
 */
export function GraficoLances({ pontos, fipe, compacto }: { pontos: Ponto[]; fipe?: number | null; compacto?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const altura = compacto ? 120 : H;

  const g = useMemo(() => {
    const ps = pontos.filter((p) => p.v > 0).map((p) => ({ x: new Date(p.t).getTime(), v: p.v, t: p.t }));
    if (!ps.length) return null;
    const agora = Date.now();
    const x0 = ps[0]!.x;
    const x1 = Math.max(ps[ps.length - 1]!.x, Math.min(agora, ps[ps.length - 1]!.x + 86_400_000 * 3));
    const vals = ps.map((p) => p.v).concat(fipe ? [fipe] : []);
    let y0 = Math.min(...vals);
    let y1 = Math.max(...vals);
    const folga = (y1 - y0 || y1 * 0.1 || 1) * 0.15;
    y0 = Math.max(0, y0 - folga);
    y1 = y1 + folga;
    const sx = (x: number) => M.l + ((x - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
    const sy = (v: number) => M.t + (1 - (v - y0) / (y1 - y0)) * (altura - M.t - M.b);
    // degraus: horizontal até o próximo ponto, depois vertical
    let d = `M${sx(ps[0]!.x)},${sy(ps[0]!.v)}`;
    for (let i = 1; i < ps.length; i++) d += ` H${sx(ps[i]!.x)} V${sy(ps[i]!.v)}`;
    d += ` H${sx(x1)}`;
    const ticks = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];
    return { ps, sx, sy, d, ticks, x0, x1 };
  }, [pontos, fipe, altura]);

  if (!g) return <p className="text-xs text-faint">Sem histórico de lances ainda.</p>;

  const mover = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let melhor = 0;
    g.ps.forEach((p, i) => {
      if (Math.abs(g.sx(p.x) - x) < Math.abs(g.sx(g.ps[melhor]!.x) - x)) melhor = i;
    });
    setHover(melhor);
  };
  const h = hover != null ? g.ps[hover] : null;

  return (
    <figure className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${altura}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Histórico de lances: ${g.ps.length} registros, último ${brl.format(g.ps[g.ps.length - 1]!.v)}`}
        onPointerMove={mover}
        onPointerLeave={() => setHover(null)}
      >
        {/* grade recessiva + eixo y à direita */}
        {g.ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={g.sy(t)} y2={g.sy(t)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={W - M.r + 8} y={g.sy(t) + 4} className="num" fill="var(--color-faint)" fontSize="11">
              {curto.format(t)}
            </text>
          </g>
        ))}
        {!compacto && (
          <>
            <text x={M.l} y={altura - 6} fill="var(--color-faint)" fontSize="11">
              {dia.format(g.x0)}
            </text>
            <text x={W - M.r} y={altura - 6} fill="var(--color-faint)" fontSize="11" textAnchor="end">
              {dia.format(g.x1)}
            </text>
          </>
        )}

        {/* FIPE como referência */}
        {fipe ? (
          <g>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={g.sy(fipe)}
              y2={g.sy(fipe)}
              stroke="var(--color-muted)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text x={W - M.r + 8} y={g.sy(fipe) - 6} fill="var(--color-muted)" fontSize="11" fontWeight="500">
              FIPE
            </text>
          </g>
        ) : null}

        <path d={g.d} fill="none" stroke="var(--color-amber)" strokeWidth="2" strokeLinejoin="round" />
        {g.ps.map((p, i) => (
          <circle
            key={i}
            cx={g.sx(p.x)}
            cy={g.sy(p.v)}
            r={hover === i ? 5 : 4}
            fill="var(--color-amber)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        ))}

        {h && (
          <line
            x1={g.sx(h.x)}
            x2={g.sx(h.x)}
            y1={M.t}
            y2={altura - M.b}
            stroke="var(--color-line-strong)"
            strokeWidth="1"
          />
        )}
      </svg>

      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-line bg-raised px-2 py-1 text-xs shadow-lg"
          style={{ left: `${(g.sx(h.x) / W) * 100}%` }}
        >
          <div className="num font-medium">{brl.format(h.v)}</div>
          <div className="num text-faint">{diaHora.format(h.x)}</div>
          {fipe ? <div className="num text-muted">{Math.round((h.v / fipe) * 100)}% da FIPE</div> : null}
        </div>
      )}
    </figure>
  );
}
