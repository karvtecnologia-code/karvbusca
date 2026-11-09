/** "R$ 31.500,00" → 31500 ; "17700.00" → 17700 */
export function dinheiro(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string") return undefined;
  let s = v.replace(/[^\d,.-]/g, "");
  if (!s) return undefined;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function inteiro(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : undefined;
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\D/g, "");
  return s ? Number(s) : undefined;
}

/**
 * Data no horário de Brasília → ISO com -03:00.
 * Aceita "2026-11-09 09:30:00", "2026-11-09T09:30", "09/11/2026" + "10:00", "09/11/2026 10:00".
 */
export function dataBR(data?: string | null, hora?: string | null): string | undefined {
  if (!data) return undefined;
  const d = data.trim();
  let y: string, m: string, dd: string, resto = "";
  let r = d.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  if (r) {
    [, y, m, dd] = r as unknown as [string, string, string, string];
    resto = r[4] ?? "";
  } else {
    r = d.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
    if (!r) return undefined;
    [, dd, m, y] = r as unknown as [string, string, string, string];
    resto = r[4] ?? "";
  }
  let h = (hora ?? resto ?? "").trim() || "00:00";
  if (/^\d{2}:\d{2}$/.test(h)) h += ":00";
  return `${y}-${m}-${dd}T${h}-03:00`;
}

const NOMES_UF: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso do sul": "MS", "mato grosso": "MT", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

/** "Minas Gerais" → "MG" (nome exato do estado, sem acento/caixa). */
export function ufPorNome(nome?: string | null): string | undefined {
  if (!nome) return undefined;
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return NOMES_UF[n] ?? (/^[a-z]{2}$/.test(n) ? n.toUpperCase() : undefined);
}

/** Extrai a UF de "curitiba i/pr", "Mogi Das Cruzes-SP", "Local: MA", "São Paulo/SP". */
export function extrairUF(texto?: string | null): string | undefined {
  if (!texto) return undefined;
  const t = texto.trim();
  const m = t.match(/(?:[\/\-,\s]|^)([A-Za-z]{2})\s*\)?\s*$/);
  if (m) return m[1]!.toUpperCase();
  const n = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const [nome, uf] of Object.entries(NOMES_UF)) if (n.includes(nome)) return uf;
  return undefined;
}

/** Extrai a cidade de "curitiba i/pr" ou "Mogi Das Cruzes-SP". */
export function extrairCidade(texto?: string | null): string | undefined {
  if (!texto) return undefined;
  const c = texto.replace(/[\/\-,]\s*[A-Za-z]{2}\s*$/, "").replace(/\s+[ivx]+$/i, "").trim();
  if (!c) return undefined;
  // \b não entende acento ("cesário" virava "CesÁrio"): capitaliza por palavra
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e"]);
  return c
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/** "2015/2016" ou "15/16" → [2015, 2016] */
export function anos(texto?: string | null): [number | undefined, number | undefined] {
  if (!texto) return [undefined, undefined];
  const m = texto.match(/\b(\d{2}|\d{4})\s*\/\s*(\d{2}|\d{4})\b/);
  if (!m) return [undefined, undefined];
  const ano = (s: string) => (s.length === 2 ? 2000 + Number(s) - (Number(s) > 50 ? 100 : 0) : Number(s));
  return [ano(m[1]!), ano(m[2]!)];
}
