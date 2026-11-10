/** Testa se /estoque aceita busca pela URL (vê a chamada à API e o 1º título exibido). */
import { chromium } from "playwright";
import { USER_AGENT } from "../src/base";

const b = await chromium.launch({ channel: "chromium" });
for (const q of ["?busca=toro", "?search=toro", "?q=toro", "?modelo=TORO", "?marca=FIAT&modelo=TORO"]) {
  const p = await b.newPage({ userAgent: USER_AGENT, locale: "pt-BR" });
  const chamadas: string[] = [];
  p.on("request", (r) => r.url().includes("search/leilao") && chamadas.push(r.url().split("?")[1] ?? ""));
  await p.goto(`https://loopleiloes.com.br/estoque${q}`, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const titulo = await p.locator("h2, h3").filter({ hasText: /[A-Z]{3,}/ }).first().innerText().catch(() => "?");
  console.log(q, "| api:", chamadas.slice(-1)[0]?.slice(0, 120), "| 1º card:", titulo.slice(0, 50));
  await p.close();
}
await b.close();
