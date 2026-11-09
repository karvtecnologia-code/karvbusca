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
import { enviarPendentes, enviarResumo } from "./alertas";
import { atualizarFipe } from "./fipe";
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
// sites que este ambiente não roda (ex.: a Loop bloqueia IP de datacenter → roda no PC)
const excluir = (process.env.KARV_SITES_EXCLUIR ?? "").split(/[\s,]+/).filter(Boolean);

const db = supabaseAdmin();
const [termos, sites] = await Promise.all([carregarTermos(db), carregarSites(db)]);
console.log(`modo=${modo} termos=${termos.map((t) => t.termo).join(",")}`);

// channel "chromium" = Chromium completo no modo sem janela (o "headless shell" padrão
// é barrado pelo desafio anti-robô da Loop/Vercel)
const browser = await chromium.launch({ headless: args.visivel !== "true", channel: "chromium" });
const resultados: Resultado[] = [];
try {
  // um site por vez, de propósito
  for (const site of sites) {
    if (!site.ativo || (filtro && !filtro.includes(site.slug)) || excluir.includes(site.slug)) continue;
    const adapter = adapters[site.slug as keyof typeof adapters];
    if (!adapter) continue;
    resultados.push(await rodarSite({ browser, db, site, adapter, termos, modo, seco: args.seco === "true" }));
  }
} finally {
  await browser.close();
}

if (args.seco !== "true") {
  await atualizarFipe(db).catch((e) => console.log(`[fipe] erro: ${(e as Error).message}`));
  // resumo da manhã: na busca das 07:00 (antes das 10h de Brasília), uma vez por dia
  const horaBR = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
  if (modo === "completo" && horaBR < 10) {
    await enviarResumo(db).catch((e) => console.log(`[telegram] resumo: ${(e as Error).message}`));
  }
  await enviarPendentes(db).catch((e) => console.log(`[telegram] erro: ${(e as Error).message}`));
}

console.table(resultados);
// falha o job só se TODOS os sites falharem (um site fora do ar não derruba o resto)
if (resultados.length && resultados.every((r) => r.erro)) process.exit(1);
