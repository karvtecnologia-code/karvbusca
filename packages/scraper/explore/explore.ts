/**
 * Exploração: abre cada site em modo visível, rola a página e registra
 * as respostas JSON internas. Saída em explore/out/<site>/ (ignorado no git).
 * Uso: pnpm explore [slug] [url-opcional]
 */
import { chromium, type Response } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ALVOS: Record<string, string[]> = {
  vip: ["https://www.vipleiloes.com.br/"],
  sodre: ["https://www.sodresantoro.com.br/veiculos/lotes"],
  sold: ["https://www.sold.com.br/"],
  freitas: [
    "https://www.freitasleiloeiro.com.br/Leiloes/Pesquisar?Categoria=1&TipoLoteId=1",
    "https://www.freitasleiloeiro.com.br/Leiloes/Pesquisar?Categoria=1&TipoLoteId=3",
  ],
  loop: ["https://loopleiloes.com.br/estoque"],
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const pausa = (min = 2000, max = 5000) =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

function chaves(v: unknown, prof = 0): unknown {
  if (prof > 2) return typeof v;
  if (Array.isArray(v)) return v.length ? [chaves(v[0], prof + 1), `…${v.length}`] : [];
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).slice(0, 40).map(([k, x]) => [k, chaves(x, prof + 1)]));
  return typeof v;
}

async function explorar(slug: string, urls: string[]) {
  const dir = path.join("explore", "out", slug);
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ userAgent: UA, locale: "pt-BR", viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const jsons: { url: string; status: number; bytes: number; metodo?: string; corpo?: string | null; forma: unknown }[] = [];
  let n = 0;

  page.on("response", async (res: Response) => {
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const body = await res.text();
      const dado = JSON.parse(body);
      const i = ++n;
      jsons.push({
        url: res.url(),
        status: res.status(),
        bytes: body.length,
        metodo: res.request().method(),
        corpo: res.request().postData(),
        forma: chaves(dado),
      });
      if (body.length > 300) await writeFile(path.join(dir, `json-${String(i).padStart(3, "0")}.json`), body);
    } catch {
      /* resposta sem corpo ou não-JSON */
    }
  });

  for (const [i, url] of urls.entries()) {
    try {
      const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      console.log(`[${slug}] ${url} → ${r?.status()}`);
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      for (let s = 0; s < 4; s++) {
        await page.mouse.wheel(0, 1600);
        await pausa(800, 1500);
      }
      await page.screenshot({ path: path.join(dir, `pagina-${i}.png`), fullPage: false });
      await writeFile(path.join(dir, `pagina-${i}.html`), await page.content());
      const links = await page.$$eval("a[href]", (as) =>
        [...new Set(as.map((a) => (a as HTMLAnchorElement).href))].filter((h) =>
          /veic|carro|moto|lote|estoque|leilao|leiloes|pesquisa|busca/i.test(h),
        ),
      );
      await writeFile(path.join(dir, `links-${i}.txt`), links.join("\n"));
    } catch (e) {
      console.log(`[${slug}] erro em ${url}: ${(e as Error).message}`);
    }
    await pausa();
  }

  await writeFile(path.join(dir, "jsons.json"), JSON.stringify(jsons, null, 2));
  console.log(`[${slug}] ${jsons.length} respostas JSON registradas`);
  await browser.close();
}

const [slug, url] = process.argv.slice(2);
const lista = slug ? { [slug]: url ? [url] : ALVOS[slug] ?? [] } : ALVOS;
for (const [s, urls] of Object.entries(lista)) await explorar(s, urls);
