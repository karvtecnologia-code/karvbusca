import { describe, expect, it } from "vitest";
import { notaOportunidade, type EntradaNota } from "../src";

const base: EntradaNota = {
  pctFipe: 0.6,
  monta: "sem_monta",
  roda: "sim",
  circulacao: "liberada",
  procedencia: "financiamento",
  chave: "sim",
  danoEstrutural: false,
  km: 60_000,
  anoMod: 2020,
  distanciaKm: 250,
  anoAtual: 2026,
};

describe("nota de oportunidade", () => {
  it("financeira sem monta, motor ok, 60% FIPE, perto → nota alta com motivos", () => {
    const r = notaOportunidade(base);
    expect(r.nota).toBeGreaterThanOrEqual(85);
    expect(r.motivos).toEqual(expect.arrayContaining(["60% FIPE", "sem monta", "financeira", "km baixo", "250 km de você"]));
  });
  it("preço pesa mais: 92% da FIPE derruba a nota", () => {
    expect(notaOportunidade({ ...base, pctFipe: 0.92 }).nota).toBeLessThan(notaOportunidade(base).nota - 30);
  });
  it("média monta de seguradora longe é pior que sem monta de financeira perto", () => {
    const ruim = notaOportunidade({ ...base, monta: "media", procedencia: "seguradora", distanciaKm: 900 });
    expect(ruim.nota).toBeLessThan(notaOportunidade(base).nota - 20);
  });
  it("dano estrutural limita a 20", () => {
    expect(notaOportunidade({ ...base, danoEstrutural: true }).nota).toBeLessThanOrEqual(20);
  });
  it("lance baixo no começo não engana: usa o preço provável de fechamento do modelo", () => {
    const r = notaOportunidade({ ...base, pctFipe: 0.4, pctProvavel: 0.85 });
    expect(r.nota).toBeLessThan(notaOportunidade({ ...base, pctFipe: 0.4 }).nota - 25);
    expect(r.motivos).toContain("deve fechar ~85%");
    // se o modelo costuma fechar mais barato que o lance atual, vale o lance atual
    expect(notaOportunidade({ ...base, pctProvavel: 0.5 }).nota).toBe(notaOportunidade(base).nota);
  });
  it("sem FIPE fica neutro, sem quebrar", () => {
    const r = notaOportunidade({ ...base, pctFipe: null, distanciaKm: null, km: null });
    expect(r.nota).toBeGreaterThan(40);
    expect(r.nota).toBeLessThan(80);
  });
});

import { extrairCor, passaFiltros } from "../src";
describe("filtros de busca", () => {
  it("acha a cor no texto", () => {
    expect(extrairCor("FIAT TORO", "Cor: Branca, flex")).toBe("branco");
    expect(extrairCor("Onix LT prata 2020")).toBe("prata");
    expect(extrairCor("Onix LT 2020")).toBeNull();
  });
  it("barra o que está fora e deixa passar o que não foi informado", () => {
    const f = { anoMin: 2018, lanceMax: 40000, cores: ["branco", "prata"], procedencias: ["financiamento"], fipeMax: 90000 };
    expect(passaFiltros({ ano: 2020, lance: 30000, cor: "prata", procedencia: "financiamento", fipe: 80000 }, f)).toBe(true);
    expect(passaFiltros({ ano: 2016, lance: 30000, procedencia: "financiamento" }, f)).toBe(false);
    expect(passaFiltros({ ano: 2020, lance: 30000, cor: "preto", procedencia: "financiamento" }, f)).toBe(false);
    expect(passaFiltros({ ano: 2020, lance: 30000, procedencia: "judicial" }, f)).toBe(false);
    expect(passaFiltros({ ano: 2020, lance: 30000, procedencia: "financiamento", fipe: 120000 }, f)).toBe(false);
    // sem cor e sem FIPE informadas: passa
    expect(passaFiltros({ ano: 2020, lance: 30000, procedencia: "financiamento" }, f)).toBe(true);
  });
});
