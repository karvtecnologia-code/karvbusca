/** Captura as chamadas AJAX (handler=pesquisar) da busca da VIP. */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const classif = process.argv[2] ?? "Sinistrados";
const dir = "explore/out/vip/ajax";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  locale: "pt-BR",
});
let i = 0;
page.on("response", async (res) => {
  if (!res.url().includes("handler=")) return;
  const req = res.request();
  const body = await res.text().catch(() => "");
  i++;
  await writeFile(
    `${dir}/${classif}-${i}.txt`,
    `${req.method()} ${res.url()}\nCT: ${res.headers()["content-type"]}\nPOST: ${req.postData() ?? ""}\n\n${body}`,
  );
  console.log(`[vip] ${req.method()} ${res.url()} ${body.length}b`);
});
await page.goto(`https://www.vipleiloes.com.br/pesquisa?classificacao=${classif}`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(3000);
const total = await page.locator("#resultadosEncontrados").innerText().catch(() => "?");
console.log(`[vip] total na tela: ${total}`);
await browser.close();
