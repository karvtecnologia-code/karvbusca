/** Testa filtros e tamanho de página da busca da Copart (POST /public/lots/search) dentro da página. */
import { chromium } from "playwright";
import { USER_AGENT } from "../src/base";

const b = await chromium.launch({ channel: "chromium" });
const p = await b.newPage({ userAgent: USER_AGENT, locale: "pt-BR" });
await p.goto("https://www.copart.com.br/search/autom%C3%B3veis/", { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});

const testes: Record<string, Record<string, string>> = {
  "padrão 100/página": { "filter[MISC]": "categoria:Automóveis", length: "100", size: "100" },
  "funcionamento (2 valores)": {
    "filter[MISC]": "categoria:Automóveis",
    "filter[FUNC]": 'condicaofuncionamento:"Motor dá partida e engrena",condicaofuncionamento:"Motor dá partida"',
    length: "100",
    size: "100",
  },
  "funcionamento sem categoria": {
    "filter[FUNC]": 'condicaofuncionamento:"Motor dá partida e engrena",condicaofuncionamento:"Motor dá partida"',
    length: "100",
    size: "100",
  },
};
for (const [nome, extra] of Object.entries(testes)) {
  const r = await p.evaluate(async (extra) => {
    const body = new URLSearchParams({
      draw: "1",
      start: "0",
      sort: "auction_date_utc asc,brazil_default_sort asc",
      defaultSort: "true",
      query: "*",
      watchListOnly: "false",
      freeFormSearch: "false",
      page: "0",
      ...extra,
    });
    const res = await fetch("/public/lots/search", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest" },
      body,
    });
    const j = await res.json().catch(() => null);
    const c = j?.data?.results?.content ?? [];
    return { status: res.status, total: j?.data?.results?.totalElements, n: c.length, func: [...new Set(c.map((x: { drivabilityRating?: string }) => x.drivabilityRating))], cat: [...new Set(c.map((x: { vehicleType?: string }) => x.vehicleType))] };
  }, extra);
  console.log(nome, JSON.stringify(r));
  await p.waitForTimeout(2500);
}
await b.close();
