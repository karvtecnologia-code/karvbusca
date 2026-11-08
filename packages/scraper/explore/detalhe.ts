/**
 * Abre uma listagem, pega os N primeiros links de lote e salva o texto visível
 * de cada página de detalhe. Uso: pnpm tsx explore/detalhe.ts <slug> <url-lista> <regex-link> [n]
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [slug, lista, padrao, nStr] = process.argv.slice(2);
if (!slug || !lista || !padrao) throw new Error("uso: detalhe.ts <slug> <url> <regex> [n]");
const n = Number(nStr ?? 4);
const dir = path.join("explore", "out", slug, "detalhes");
await mkdir(dir, { recursive: true });

const pausa = () => new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  locale: "pt-BR",
});
await page.goto(lista, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
const re = new RegExp(padrao);
const links = [...new Set(await page.$$eval("a[href]", (as) => as.map((a) => (a as HTMLAnchorElement).href)))]
  .filter((h) => re.test(h))
  .slice(0, n);
console.log(`[${slug}] ${links.length} links`);

for (const [i, url] of links.entries()) {
  await pausa();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const texto = await page.evaluate(() => document.body.innerText);
  await writeFile(path.join(dir, `${i}.txt`), `${url}\n\n${texto}`);
  await writeFile(path.join(dir, `${i}.html`), await page.content());
  console.log(`[${slug}] ${url}`);
}
await browser.close();
