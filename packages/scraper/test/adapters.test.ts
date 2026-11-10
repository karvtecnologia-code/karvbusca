/**
 * Testes com HTML/JSON reais capturados em 08/11/2026.
 * Se um site mudar o formato, estes testes continuam passando (fixture antiga),
 * mas o robô vai trazer 0 lotes e o alerta "robô falhou" dispara. Aí basta
 * capturar uma nova fixture com `pnpm explore <site>` e ajustar o adaptador.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFreitasDetalhe, parseFreitasLista } from "../src/adapters/freitas";
import { parseLoop, parseLoopDetalhe } from "../src/adapters/loop";
import { parseSodre } from "../src/adapters/sodre";
import { parseSold, parseSoldDetalhe } from "../src/adapters/sold";
import { parseVipDetalhe, parseVipLista } from "../src/adapters/vip";

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;

describe("Sodré", () => {
  const lotes = parseSodre(JSON.parse(fx("sodre-search.json")));
  it("lê os lotes com campos essenciais", () => {
    expect(lotes.length).toBeGreaterThanOrEqual(8);
    for (const l of lotes) {
      expect(l.idExterno).toMatch(/^\d+$/);
      expect(l.url).toMatch(/^https:\/\/leilao\.sodresantoro\.com\.br\/leilao\/\d+\/lote\/\d+\/$/);
      expect(l.titulo.length).toBeGreaterThan(3);
      expect(["carro", "moto"]).toContain(l.tipo);
      expect(l.uf).toMatch(/^[A-Z]{2}$/);
      expect(l.fimEm).toMatch(ISO);
      expect(l.condicaoTexto).toMatch(/sinistro|monta/);
    }
  });
  it("tem lotes de SP e de fora (o pipeline filtra)", () => {
    expect(lotes.some((l) => l.uf === "SP")).toBe(true);
    expect(lotes.some((l) => l.uf === "PR")).toBe(true);
  });
});

describe("Sold", () => {
  const lotes = parseSold(JSON.parse(fx("sold-offers.json")));
  it("lê as ofertas de veículos", () => {
    expect(lotes.length).toBeGreaterThan(0);
    for (const l of lotes) {
      expect(l.idExterno).toMatch(/^\d+$/);
      // superbid.net abre ofertas de qualquer loja do Superbid (inclusive as da Sold)
      expect(l.url).toMatch(new RegExp(`^https://www\.superbid\.net/oferta/.+-${l.idExterno}$`));
      expect(l.fimEm).toMatch(ISO);
      expect(l.fotos.length).toBeGreaterThan(0);
    }
    expect(lotes.find((l) => l.idExterno === "5082771")!.anoMod).toBe(2019);
  });
  it("ignora peças, lê estado, tipo, condição e FIPE da API", () => {
    expect(lotes.some((l) => l.idExterno === "5082765")).toBe(false); // suporte rolete = peça
    const ka = lotes.find((l) => l.idExterno === "5083667")!;
    expect(ka).toMatchObject({ uf: "SP", tipo: "carro" });
    expect(ka.titulo).toMatch(/DANO MEDIA MONTA/);
    const bros = lotes.find((l) => l.idExterno === "5071943")!;
    expect(bros).toMatchObject({ tipo: "moto", cidade: "Pinhais", uf: undefined, fipeSite: 14757 });
    expect(bros.condicaoTexto).toMatch(/Situa[cç][aã]o: em circula[cç][aã]o. Motor n[aã]o testado/);
  });
  it("detalhe: local, motor e chave", () => {
    const d = parseSoldDetalhe(fx("sold-detalhe.txt"), lotes[0]!);
    expect(d.uf).toBe("RS");
    expect(d.cidade).toBe("Cachoeirinha");
    expect(d.condicaoTexto).toMatch(/motor FUNCIONANDO/i);
    expect(d.chave).toBe("sim");
  });
});

describe("Loop", () => {
  const lotes = parseLoop(JSON.parse(fx("loop-search.json")));
  const gol = () => lotes.find((l) => l.idExterno === "60062019")!;
  it("lê os lotes com UF, ano e lance (id = SKU do veículo)", () => {
    expect(lotes.length).toBeGreaterThan(0);
    expect(gol()).toMatchObject({ uf: "SP", cidade: "Mogi das Cruzes", anoMod: 2013, tipo: "carro", lanceAtual: 12000 });
    expect(gol().url).toBe("https://loopleiloes.com.br/leilao/exclusivo-edp/vw-novo-gol-1-0-city-2012-2013/2819/172948");
    expect(gol().fotos[0]).toMatch(/vehicle-photos\/o\/md\/.+\.jpg$/);
  });
  it("estoque sem leilão marcado entra como 'estoque' (Em breve), sem data", () => {
    const [e] = parseLoop({
      hits: [
        {
          _source: {
            sku: "60069040",
            slug: "hyundai-hb20x-16a-evolut-2021-2022-60069040",
            lotId: null,
            url: null,
            category: "Leve",
            brand: "HYUNDAI",
            model: "HB20X",
            location: "Uberlândia-MG",
          },
        },
      ],
    });
    expect(e).toMatchObject({
      idExterno: "60069040",
      status: "estoque",
      uf: "MG",
      url: "https://loopleiloes.com.br/veiculo/hyundai-hb20x-16a-evolut-2021-2022-60069040",
    });
    expect(e!.fimEm).toBeUndefined();
  });
  it("detalhe: encerramento real, vistoria, FIPE e taxas", () => {
    const d = parseLoopDetalhe(fx("loop-detalhe.html"), gol());
    expect(d.fimEm).toBe("2026-11-23T15:08:15-03:00");
    expect(d.condicaoTexto).toBe("motor funciona"); // "Sucata: Não" não pode virar "sucata"
    expect(d.chave).toBe("sim");
    expect(d.observacoes).toMatch(/LONGARINA/);
    expect(d.fipeSite).toBe(30385);
    // administração + transporte + inspeção + regularização + estadia (pátio) + remessa
    expect(d.taxasSite).toBe(1900 + 450 + 190 + 200 + 5815 + 50);
  });
});

describe("VIP", () => {
  const lotes = parseVipLista(fx("vip-pesquisa.html"));
  it("lê os cards da pesquisa", () => {
    expect(lotes.length).toBeGreaterThanOrEqual(10);
    const palio = lotes.find((l) => l.idExterno === "339813")!;
    expect(palio).toMatchObject({
      titulo: "FIAT PALIO ELX FLEX",
      anoFab: 2005,
      anoMod: 2006,
      uf: "MA",
      lanceAtual: 3700,
      lanceInicial: 3100,
      fimEm: "2026-11-09T09:30:00-03:00",
    });
    expect(palio.fotos[0]).toMatch(/^https:\/\/.+\.jpg$/);
  });
  it("detalhe: funcionando na entrada, chave, local e procedência", () => {
    const d = parseVipDetalhe(fx("vip-detalhe.txt"), lotes[0]!);
    expect(d.condicaoTexto).toMatch(/funcionando na entrada N[aã]o/i);
    expect(d.chave).toBe("nao");
    expect(d.uf).toBe("MA");
    expect(d.cidade).toBe("SÃO LUÍS");
    expect(d.procedenciaTexto).toMatch(/Patrim[oô]nio/);
  });
});

describe("Freitas", () => {
  const lotes = parseFreitasLista(fx("freitas-lista.html"), "carro");
  it("lê os cards", () => {
    expect(lotes.length).toBe(12);
    expect(lotes[0]).toMatchObject({
      idExterno: "8162-1",
      marca: "HONDA",
      modelo: "FIT EX CVT",
      anoFab: 2015,
      anoMod: 2016,
      lanceAtual: 31500,
      fimEm: "2026-11-09T10:00:00-03:00",
      uf: "SP",
    });
    expect(lotes[0]!.condicaoTexto).toMatch(/M[EÉ]DIA MONTA/);
  });
  it("detalhe: aviso de circulação vedada", () => {
    const d = parseFreitasDetalhe(fx("freitas-detalhe.txt"), lotes[0]!);
    expect(d.condicaoTexto).toMatch(/CIRCUL VEDADA/);
  });
});
