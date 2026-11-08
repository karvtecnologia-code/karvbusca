/** Salva o texto visível de uma URL. Uso: pnpm tsx explore/texto.ts <url> <arquivo> */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { USER_AGENT } from "../src/base";

const [url, arquivo] = process.argv.slice(2);
if (!url || !arquivo) throw new Error("uso: texto.ts <url> <arquivo>");
const browser = await chromium.launch();
const page = await browser.newPage({ userAgent: USER_AGENT, locale: "pt-BR" });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
await writeFile(arquivo, `${page.url()}\n\n${await page.evaluate(() => document.body.innerText)}`);
await browser.close();
