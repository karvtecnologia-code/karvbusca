"use client";

import { useEffect } from "react";

/** Grava a hora desta visita (depois de alguns segundos), para o selo "Novo" da próxima. */
export function MarcarVisita() {
  useEffect(() => {
    const t = setTimeout(() => {
      document.cookie = `kb_visita=${Date.now()}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
