/**
 * Exploração de sites candidatos: dados de legalidade (leiloeiro oficial, Junta Comercial, CNPJ)
 * e como os lotes de veículos chegam (APIs JSON chamadas pela página).
 * Uso: pnpm tsx explore/novos-sites.ts
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { USER_AGENT } from "../src/base";

const SITES: Record<string, string[]> = {
  copart: ["https://www.copart.com.br/", "https://www.copart.com.br/search/"],
  mega: ["https://www.megaleiloes.com.br/", "https://www.megaleiloes.com.br/veiculos"],
  zukerman: ["https://www.zukerman.com.br/", "https://www.zukerman.com.br/veiculos"],
  pestana: ["https://www.pestanaleiloes.com.br/", "https://www.pestanaleiloes.com.br/veiculos"],
};

const LEGAL = /leiloeir[oa] oficial|jucesp|jucemg|jucepar|jucerja|junta comercial|matr[ií]cula\s*(n[º°o.]*)?\s*\d+|cnpj[:\s]*[\d./-]{14,}/gi;

const b = await chromium.launch({ channel: "chromium" });
for (const [slug, urls] of Object.entries(SITES)) {
  const dir = `explore/out/novos/${slug}`;
  await mkdir(dir, { recursive: true });
  const ctx = await b.newContext({ userAgent: USER_AGENT, locale: "pt-BR", viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const jsons: { url: string; status: number; bytes: number }[] = [];
  p.on("response", async (r) => {
    if (!(r.headers()["content-type"] ?? "").includes("json")) return;
    const t = await r.text().catch(() => "");
    if (t.length > 800 && !/google|facebook|hotjar|clarity|hubspot|rdstation|onesignal|zendesk/.test(r.url()))
      jsons.push({ url: r.url(), status: r.status(), bytes: t.length });
    if (t.length > 3000) await writeFile(`${dir}/json-${jsons.length}.json`, t).catch(() => {});
  });
  for (const [i, url] of urls.entries()) {
    const r = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => (console.log(slug, url, "ERRO", e.message.slice(0, 80)), null));
    await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    for (let s = 0; s < 3; s++) {
      await p.mouse.wheel(0, 2000);
      await p.waitForTimeout(900);
    }
    const titulo = await p.title().catch(() => "");
    const texto = await p.evaluate(() => document.body.innerText).catch(() => "");
    await writeFile(`${dir}/texto-${i}.txt`, `${p.url()}\n\n${texto}`);
    await writeFile(`${dir}/pagina-${i}.html`, await p.content().catch(() => ""));
    const legal = [...new Set((texto.match(LEGAL) ?? []).map((x) => x.trim()))].slice(0, 12);
    const links = [...new Set(await p.$$eval("a[href]", (as) => as.map((a) => (a as HTMLAnchorElement).href)).catch(() => []))].filter((h) =>
      /ve[ií]cul|carro|moto|lote|leil[aã]o|search|busca|pesquisa/i.test(h),
    );
    await writeFile(`${dir}/links-${i}.txt`, links.join("\n"));
    console.log(`\n[${slug}] ${url} → ${r?.status()} final=${p.url()} titulo="${titulo.slice(0, 60)}"`);
    console.log(`   legal: ${legal.join(" | ") || "(nada na página)"}`);
    await p.waitForTimeout(3000);
  }
  console.log(`   JSONs: ${jsons.slice(0, 8).map((j) => `${j.status} ${j.bytes}b ${j.url.slice(0, 110)}`).join("\n          ") || "(nenhum)"}`);
  await ctx.close();
}
await b.close();
