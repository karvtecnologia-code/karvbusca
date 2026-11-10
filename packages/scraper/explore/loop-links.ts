/** Abre links /veiculo/<slug> da Loop e mostra o título carregado (confere se o slug leva ao carro certo). */
import { chromium } from "playwright";
import { USER_AGENT } from "../src/base";

const b = await chromium.launch({ channel: "chromium" });
const p = await b.newPage({ userAgent: USER_AGENT, locale: "pt-BR" });
for (const url of process.argv.slice(2)) {
  const r = await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => !/checkpoint/i.test(document.title), null, { timeout: 30000 }).catch(() => {});
  await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const h1 = await p.locator("h1").first().innerText().catch(() => "(sem h1)");
  console.log(r?.status(), "|", p.url().replace("https://loopleiloes.com.br", ""), "|", h1.replace(/\s+/g, " ").slice(0, 70));
  await p.waitForTimeout(2500);
}
await b.close();
