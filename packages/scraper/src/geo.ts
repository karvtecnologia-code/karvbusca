import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizar } from "@karv/core";

// Serviços abertos e gratuitos. O Nominatim pede 1 consulta/s e um User-Agent que identifique o app.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const UA = "KarvBusca/1.0 (monitor pessoal de leiloes)";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocodificar(cidade: string, uf: string) {
  const p = new URLSearchParams({ city: cidade, state: uf, country: "Brazil", format: "json", limit: "1" });
  const r = await fetch(`${NOMINATIM}?${p}`, { headers: { "user-agent": UA, "accept-language": "pt-BR" } });
  if (!r.ok) throw new Error(`Nominatim HTTP ${r.status}`);
  const [hit] = (await r.json()) as { lat: string; lon: string }[];
  return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
}

async function rotaKm(de: { lat: number; lon: number }, para: { lat: number; lon: number }) {
  const r = await fetch(`${OSRM}/${de.lon},${de.lat};${para.lon},${para.lat}?overview=false`, {
    headers: { "user-agent": UA },
  });
  if (!r.ok) throw new Error(`OSRM HTTP ${r.status}`);
  const j = (await r.json()) as { routes?: { distance: number }[] };
  const m = j.routes?.[0]?.distance;
  return m != null ? Math.round(m / 1000) : null;
}

/** Preenche distancia_km dos lotes abertos, com cache por cidade. No máximo `limite` cidades novas por execução. */
export async function atualizarDistancias(db: SupabaseClient, log = console.log, limite = 25) {
  const { data: cfg } = await db.from("config").select("origem_lat, origem_lon").single();
  if (!cfg) return;
  const origem = { lat: Number(cfg.origem_lat), lon: Number(cfg.origem_lon) };

  const { data: lotes } = await db
    .from("lotes")
    .select("id, cidade, uf")
    .is("distancia_km", null)
    .not("cidade", "is", null)
    .in("uf", ["SP", "MG"])
    .limit(400);
  if (!lotes?.length) return;

  const chaves = [...new Set(lotes.map((l) => `${normalizar(l.cidade)}|${l.uf}`))];
  const { data: cache } = await db.from("cidades_geo").select("chave, distancia_km").in("chave", chaves);
  const dist = new Map((cache ?? []).map((c) => [c.chave, c.distancia_km as number | null]));

  let novas = 0;
  for (const ch of chaves) {
    if (dist.has(ch) || novas >= limite) continue;
    const exemplo = lotes.find((l) => `${normalizar(l.cidade)}|${l.uf}` === ch)!;
    try {
      const pt = await geocodificar(exemplo.cidade!, exemplo.uf!);
      await espera(1100); // regra do Nominatim: 1 consulta por segundo
      const km = pt ? await rotaKm(origem, pt) : null;
      await db.from("cidades_geo").upsert({ chave: ch, lat: pt?.lat ?? null, lon: pt?.lon ?? null, distancia_km: km });
      dist.set(ch, km);
      novas++;
    } catch (e) {
      log(`[geo] ${exemplo.cidade}-${exemplo.uf}: ${(e as Error).message}`);
      break; // serviço fora: tenta na próxima execução
    }
  }

  let n = 0;
  for (const l of lotes) {
    const km = dist.get(`${normalizar(l.cidade)}|${l.uf}`);
    if (km == null) continue;
    await db.from("lotes").update({ distancia_km: km }).eq("id", l.id);
    n++;
  }
  log(`[geo] ${novas} cidades novas, ${n} lotes com distância`);
}
