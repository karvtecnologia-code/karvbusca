/** Lista as chamadas à API da Loop feitas por uma página de detalhe. */
import { chromium } from "playwright";
import { USER_AGENT } from "../src/base";

const url = process.argv[2]!;
const b = await chromium.launch({ channel: "chromium" });
const p = await b.newPage({ userAgent: USER_AGENT, locale: "pt-BR" });
p.on("response", async (r) => {
  if (!/loopleiloes|loopbrasil/.test(r.url()) || /_next\/static|\.(js|css|png|jpg|svg|woff2?)/.test(r.url())) return;
  const ct = r.headers()["content-type"] ?? "";
  console.log(r.request().method(), r.status(), ct.split(";")[0], r.url().slice(0, 160));
  if (/api\.loopleiloes\.com\.br\/auction\/lots\/\d+$/.test(r.url())) {
    const h = await r.request().allHeaders();
    // mostra os nomes e o formato (sem expor valores inteiros)
    for (const [k, v] of Object.entries(h)) console.log("   ", k, "=", v.length > 40 ? `${v.slice(0, 18)}…(${v.length})` : v);
  }
});
await p.goto(url, { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
// o JSON do Next traz a query usada no servidor: queryKey revela o endpoint
const keys = await p.evaluate(() => {
  const el = document.getElementById("__NEXT_DATA__");
  if (!el) return null;
  const d = JSON.parse(el.textContent!);
  return d.props?.pageProps?.dehydratedState?.queries?.map((q: { queryKey: unknown }) => q.queryKey);
});
console.log("queryKeys:", JSON.stringify(keys));
await b.close();
