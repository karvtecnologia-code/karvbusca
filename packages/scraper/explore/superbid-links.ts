/** Testa quais endereços abrem uma oferta do Superbid de outra loja (não-Sold). */
import { chromium } from "playwright";
import { USER_AGENT } from "../src/base";

const id = process.argv[2] ?? "5064233";
const slug = process.argv[3] ?? "mmc-asx-20-cvt-2014-2015-branca";
const b = await chromium.launch({ channel: "chromium" });
const p = await b.newPage({ userAgent: USER_AGENT, locale: "pt-BR" });
for (const url of [
  `https://www.sold.com.br/oferta/${slug}-${id}`,
  `https://www.superbid.net/oferta/${slug}-${id}`,
  `https://www.superbid.net/oferta/${id}`,
]) {
  const r = await p.goto(url, { waitUntil: "domcontentloaded" }).catch(() => null);
  await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const texto = (await p.evaluate(() => document.body.innerText).catch(() => "")).replace(/\s+/g, " ");
  const chave = (process.argv[4] ?? "ASX").toUpperCase();
  const achou = texto.toUpperCase().includes(chave) && !/não foram encontrados resultados/i.test(texto);
  const erro = /não encontrad|not found|página não existe|404/i.test(texto);
  console.log(r?.status(), achou ? "ABRE O LOTE" : erro ? "NÃO ENCONTRADO" : "?", "|", p.url(), "|", texto.slice(0, 90));
  await p.waitForTimeout(2000);
}
await b.close();
