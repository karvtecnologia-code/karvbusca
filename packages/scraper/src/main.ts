/**
 * Robô do KarvBusca.
 *   pnpm scrape                          → busca completa nos sites ativos
 *   pnpm scrape --modo=favoritos         → só atualiza lances dos favoritos
 *   pnpm scrape --sites=loop,sodre       → só esses sites
 *   pnpm scrape --seco                   → não grava nada, só mostra o que acharia
 *   pnpm scrape --visivel                → abre o navegador na tela
 */
import { chromium } from "playwright";
import { adapters } from "./adapters";
import { enviarPendentes } from "./alertas";
import { carregarSites, carregarTermos, supabaseAdmin } from "./db";
import { rodarSite, type Modo, type Resultado } from "./pipeline";

try {
  process.loadEnvFile(new URL("../../../apps/web/.env.local", import.meta.url));
} catch {
  /* no GitHub Actions as variáveis vêm dos secrets */
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? "true"];
  }),
);
const modo: Modo = args.modo === "favoritos" ? "favoritos" : "completo";
const filtro = args.sites?.split(/[\s,]+/).filter(Boolean); // o PowerShell troca vírgula por espaço

const db = supabaseAdmin();
const [termos, sites] = await Promise.all([carregarTermos(db), carregarSites(db)]);
console.log(`modo=${modo} termos=${termos.map((t) => t.termo).join(",")}`);

const browser = await chromium.launch({ headless: args.visivel !== "true" });
const resultados: Resultado[] = [];
try {
  // um site por vez, de propósito
  for (const site of sites) {
    if (!site.ativo || (filtro && !filtro.includes(site.slug))) continue;
    const adapter = adapters[site.slug as keyof typeof adapters];
    if (!adapter) continue;
    resultados.push(await rodarSite({ browser, db, site, adapter, termos, modo, seco: args.seco === "true" }));
  }
} finally {
  await browser.close();
}

if (args.seco !== "true") {
  await enviarPendentes(db).catch((e) => console.log(`[telegram] erro: ${(e as Error).message}`));
}

console.table(resultados);
// falha o job só se TODOS os sites falharem (um site fora do ar não derruba o resto)
if (resultados.length && resultados.every((r) => r.erro)) process.exit(1);
