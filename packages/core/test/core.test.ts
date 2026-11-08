import { describe, expect, it } from "vitest";
import {
  casarTermos,
  classificarMonta,
  classificarRoda,
  compactar,
  contemPalavra,
  custoReal,
  normalizar,
  pctFipe,
} from "../src";
import type { LoteColetado, TermoBusca } from "../src";

const termo = (o: Partial<TermoBusca>): TermoBusca => ({
  id: "1",
  termo: "hrv",
  apelidos: ["hr-v", "hr v"],
  tipo: null,
  anoMin: null,
  anoMax: null,
  lanceMax: null,
  ativo: true,
  ...o,
});
const lote = (o: Partial<LoteColetado>): LoteColetado => ({
  site: "vip",
  idExterno: "1",
  url: "x",
  titulo: "",
  fotos: [],
  raw: {},
  ...o,
});

describe("normalizar", () => {
  it("tira acento, hífen e espaço extra", () => {
    expect(normalizar("  HONDA  HR-V Média ")).toBe("honda hr v media");
    expect(compactar("HR-V")).toBe("hrv");
    expect(compactar("hr v")).toBe("hrv");
  });
});

describe("matching", () => {
  it("casa variações de HR-V", () => {
    for (const t of ["Honda HR-V EX", "HONDA/HRV", "honda hr v 1.8"]) {
      expect(contemPalavra(t, "hrv")).toBe(true);
    }
  });
  it("palavra inteira: bros não casa com Ambrosio", () => {
    expect(contemPalavra("Leiloeiro Ambrosio", "bros")).toBe(false);
    expect(contemPalavra("HONDA NXR 160 BROS ESDD", "bros")).toBe(true);
    expect(contemPalavra("Mitsubishi ASX 2.0", "asx")).toBe(true);
    expect(contemPalavra("Mitsubishi Lasx", "asx")).toBe(false);
  });
  it("aplica tipo, ano, lance e ativo", () => {
    const t = termo({ termo: "bros", apelidos: [], tipo: "moto", anoMin: 2015, lanceMax: 10000 });
    const base = { titulo: "Honda Bros 160", tipo: "moto" as const };
    expect(casarTermos(lote({ ...base, anoMod: 2018, lanceAtual: 8000 }), [t])).toHaveLength(1);
    expect(casarTermos(lote({ ...base, anoMod: 2012 }), [t])).toHaveLength(0);
    expect(casarTermos(lote({ ...base, lanceAtual: 12000 }), [t])).toHaveLength(0);
    expect(casarTermos(lote({ ...base, tipo: "carro" }), [t])).toHaveLength(0);
    expect(casarTermos(lote(base), [{ ...t, ativo: false }])).toHaveLength(0);
  });
});

describe("classificação", () => {
  it("monta", () => {
    expect(classificarMonta("Veículo de GRANDE MONTA")).toBe("grande");
    expect(classificarMonta("Média Monta")).toBe("media");
    expect(classificarMonta("Recuperado de financiamento, sem monta")).toBe("sem_monta");
    expect(classificarMonta("sucata para desmonte")).toBe("sucata");
    expect(classificarMonta("bom estado")).toBe("nao_informado");
  });
  it("roda", () => {
    expect(classificarRoda("motor funciona, dá partida")).toBe("sim");
    expect(classificarRoda("Não dá partida")).toBe("nao");
    expect(classificarRoda("motor travado")).toBe("nao");
    expect(classificarRoda("")).toBe("nao_informado");
  });
});

describe("custo real", () => {
  it("calcula custo e % FIPE", () => {
    expect(
      custoReal({ lance: 10000, comissaoPct: 5, taxaAdm: 300, patio: 200, frete: 500, documentacao: 1000 }),
    ).toBe(12500);
    expect(pctFipe(7000, 10000)).toBe(0.7);
    expect(pctFipe(7000, null)).toBeNull();
  });
});
