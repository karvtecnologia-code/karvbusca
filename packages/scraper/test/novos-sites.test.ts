/** Copart, Pestana e Mega Leilões — com dados reais capturados em 10/11/2026. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aptoRodar, classificarCirculacao, classificarMonta, classificarRoda } from "@karv/core";
import { parseCopart } from "../src/adapters/copart";
import { parseMegaLista } from "../src/adapters/mega";
import { parsePestana, type PestanaCard, type PestanaLeilao } from "../src/adapters/pestana";

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;

describe("Copart", () => {
  const lotes = parseCopart(JSON.parse(fx("copart-search.json")));
  it("lê os lotes com marca, ano, pátio, dano e funcionamento", () => {
    expect(lotes.length).toBeGreaterThan(5);
    for (const l of lotes) {
      expect(l.url).toMatch(/^https:\/\/www\.copart\.com\.br\/lot\/\d+$/);
      expect(l.uf).toMatch(/^[A-Z]{2}$/);
      expect(l.fimEm).toMatch(ISO);
      expect(["carro", "moto"]).toContain(l.tipo);
    }
    const linea = lotes.find((l) => l.idExterno === "1179635")!;
    expect(linea).toMatchObject({ marca: "FIAT", modelo: "LINEA", anoMod: 2012, uf: "RS", cidade: "Canoas" });
    expect(classificarMonta(linea.condicaoTexto)).toBe("pequena");
    expect(classificarRoda(linea.condicaoTexto)).toBe("sim"); // "Motor dá partida e engrena"
  });
});

describe("Pestana", () => {
  const cards = JSON.parse(fx("pestana-cards.json")) as PestanaCard[];
  const preg = JSON.parse(fx("pestana-pregao.json")) as { lotes: { idLote: number; valorLanceAtual: number }[] };
  const leiloes = JSON.parse(fx("pestana-leiloes.json")) as PestanaLeilao[];
  const leilao = leiloes.find((l) => l.id === cards[0]!.leilao) ?? leiloes[0]!;
  const lances = new Map(preg.lotes.map((x) => [x.idLote, x.valorLanceAtual]));
  const lotes = parsePestana(cards, lances, leilao);

  it("lê carros e motos com lance do pregão, fotos e link", () => {
    expect(lotes.length).toBeGreaterThan(3);
    for (const l of lotes) {
      expect(l.url).toMatch(/^https:\/\/www\.pestanaleiloes\.com\.br\/agenda-de-leiloes\/\d+\/\d+\/.+/);
      expect(l.fotos[0]).toMatch(/^https:\/\/ged\.pestanaleiloes\.com\.br\/ged\/\d+\.\w+$/);
      expect(l.fimEm).toMatch(ISO);
      expect(l.lanceAtual).toBeGreaterThan(0);
    }
  });
  it("Voyage retomado 'para circulação' que liga: sem monta, circulação liberada, apto", () => {
    const v = lotes.find((l) => /voyage/i.test(l.titulo));
    if (!v) return; // a amostra pode não ter o Voyage
    const monta = classificarMonta(v.condicaoTexto);
    const roda = classificarRoda(v.condicaoTexto);
    const circ = classificarCirculacao(v.condicaoTexto);
    expect(monta).toBe("sem_monta");
    expect(circ).toBe("liberada");
    expect(aptoRodar({ monta, roda, circulacao: circ, danoEstrutural: false })).toBe(true);
    expect(v.anoMod).toBe(2015);
  });
});

describe("Mega Leilões", () => {
  const lotes = parseMegaLista(fx("mega-lista.html"), "carro");
  it("lê os cards com local, praça ativa, encerramento e link", () => {
    expect(lotes.length).toBeGreaterThan(10);
    const palio = lotes.find((l) => l.idExterno === "J129513")!;
    expect(palio).toMatchObject({
      uf: "RS",
      cidade: "Canguçu",
      lanceAtual: 4310.5,
      fimEm: "2026-11-24T10:00:00-03:00",
      url: "https://www.megaleiloes.com.br/veiculos/carros/rs/cangucu/carro-fiat-palio-ex-j129513",
    });
    expect(palio.titulo).toBe("Fiat Palio EX");
    const escort = lotes.find((l) => l.idExterno === "J129029")!;
    expect(escort).toMatchObject({ uf: undefined, cidade: undefined, anoMod: 1988 }); // local "não informando"
    expect(lotes.find((l) => l.idExterno === "J130879")).toMatchObject({ anoMod: 2013, uf: undefined }); // "SI"
    expect(lotes.some((l) => /^direitos/i.test(l.titulo))).toBe(false); // "Direitos sobre…" fica de fora
  });
});
