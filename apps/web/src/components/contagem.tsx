"use client";

import { useEffect, useState } from "react";

function partes(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Contagem regressiva até o encerramento; âmbar quando faltam menos de 24h. */
export function Contagem({ fim, className = "" }: { fim: string | null; className?: string }) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!fim) return <span className={`num text-faint ${className}`}>sem data</span>;
  const alvo = new Date(fim).getTime();
  if (agora == null) return <span className={`num text-faint ${className}`}>—</span>; // evita divergência SSR
  const resta = alvo - agora;
  if (resta <= 0) return <span className={`num text-faint ${className}`}>encerrado</span>;
  const urgente = resta < 86_400_000;
  return (
    <span className={`num ${urgente ? "text-amber" : "text-muted"} ${className}`} title={new Date(fim).toLocaleString("pt-BR")}>
      {partes(resta)}
    </span>
  );
}
