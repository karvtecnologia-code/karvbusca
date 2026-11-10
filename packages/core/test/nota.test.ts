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
  it("sem FIPE fica neutro, sem quebrar", () => {
    const r = notaOportunidade({ ...base, pctFipe: null, distanciaKm: null, km: null });
    expect(r.nota).toBeGreaterThan(40);
    expect(r.nota).toBeLessThan(80);
  });
});
