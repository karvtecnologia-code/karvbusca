import type { Browser, BrowserContext, Page } from "playwright";
import type { LoteColetado, SiteSlug, TermoBusca } from "@karv/core";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** Pausa aleatória entre páginas (padrão 2 a 5 s), para não sobrecarregar o site. */
export function pausa(min = 2000, max = 5000) {
  const ms = process.env.KARV_SEM_PAUSA ? 0 : min + Math.random() * (max - min);
  return new Promise((r) => setTimeout(r, ms));
}

export interface Ctx {
  page: Page;
  termos: TermoBusca[];
  log: (msg: string) => void;
}

export interface Adapter {
  slug: SiteSlug;
  /** Coleta a listagem (já restrita a veículos; UF e termos são filtrados no pipeline). */
  listar(ctx: Ctx): Promise<LoteColetado[]>;
  /** Completa um lote com a página de detalhe (condição, local, encerramento). */
  detalhar?(ctx: Ctx, lote: LoteColetado): Promise<LoteColetado>;
}

export async function novoContexto(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    userAgent: USER_AGENT,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 900 },
  });
}

export async function abrir(page: Page, url: string) {
  let r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // 429 = "devagar": espera 30 s, 60 s e 90 s antes de desistir
  for (let t = 1; r?.status() === 429 && t <= 3; t++) {
    await pausa(30_000 * t, 30_000 * t + 5000);
    r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }
  if (r && r.status() >= 400) throw new Error(`HTTP ${r.status()} em ${url}`);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const titulo = await page.title();
  if (/just a moment|attention required|access denied/i.test(titulo)) {
    throw new Error(`Bloqueio anti-robô em ${url} ("${titulo}")`);
  }
}

/**
 * Requisição direta (sem abrir a página), com os cabeçalhos de um navegador vindo do site.
 * Repete em caso de 429 com espera crescente.
 */
export async function pedir(page: Page, url: string, origem: string): Promise<string> {
  for (let t = 0; ; t++) {
    const r = await page.request.get(url, {
      headers: { "user-agent": USER_AGENT, origin: origem, referer: `${origem}/`, accept: "*/*" },
      timeout: 60_000,
    });
    if (r.status() === 429 && t < 3) {
      await pausa(30_000 * (t + 1), 30_000 * (t + 1) + 5000);
      continue;
    }
    if (!r.ok()) throw new Error(`HTTP ${r.status()} em ${url}`);
    return r.text();
  }
}

/** Texto visível da página, igual ao que salvamos nas fixtures. */
export function textoVisivel(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

/** Linhas não vazias, sem espaços nas pontas. */
export function linhas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Valor do campo "Rótulo\nValor" ou "Rótulo\tValor" ou "Rótulo: Valor" num texto em linhas. */
export function campo(ls: string[], rotulo: string): string | undefined {
  const r = rotulo.toLowerCase();
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i]!;
    const low = l.toLowerCase();
    if (low === r || low === `${r}:`) return ls[i + 1];
    const m = l.match(/^([^:\t]+)[:\t]\s*(.+)$/);
    if (m && m[1]!.trim().toLowerCase() === r) return m[2]!.trim();
  }
  return undefined;
}
