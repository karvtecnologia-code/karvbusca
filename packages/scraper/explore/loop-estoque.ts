/** Descobre o link de um veículo de estoque (sem leilão) da Loop. */
import { chromium } from "playwright";
import { USER_AGENT } from "../src/base";

const b = await chromium.launch({ channel: "chromium" });
const p = await b.newPage({ userAgent: USER_AGENT, locale: "pt-BR" });
await p.goto("https://loopleiloes.com.br/estoque", { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
for (let i = 0; i < 12; i++) {
  await p.mouse.wheel(0, 2500);
  await p.waitForTimeout(700);
}
const links = await p.$$eval("a[href]", (as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!))]);
const outros = links.filter((h) => !h.startsWith("/leilao/") && /\d{6,}|veiculo|estoque\//.test(h));
console.log("links que não são /leilao/:", outros.slice(0, 15));
console.log("total /leilao/:", links.filter((h) => h.startsWith("/leilao/")).length);
await b.close();
