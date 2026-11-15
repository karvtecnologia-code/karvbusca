import type { FiltrosBusca } from "@karv/core";

/** Lê e limpa o JSON vindo do formulário (servidor). */
export function lerFiltros(v: FormDataEntryValue | null): FiltrosBusca {
  try {
    const o = JSON.parse(String(v ?? "{}")) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) {
      if (Array.isArray(x)) {
        if (x.length) out[k] = x.map(String).slice(0, 30);
      } else if (typeof x === "number" && Number.isFinite(x)) out[k] = x;
      else if (x === true) out[k] = true;
    }
    return out as FiltrosBusca;
  } catch {
    return {};
  }
}
