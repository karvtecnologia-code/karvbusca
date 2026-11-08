import { describe, expect, it } from "vitest";
import {
  aptoRodar,
  classificarCirculacao,
  classificarMonta,
  classificarProcedencia,
  classificarRoda,
  danosEstruturais,
} from "../src";

// Textos copiados dos sites durante a exploração (08/11/2026)
const FREITAS =
  "SEGURADORA / SINISTRO/MÉDIA MONTA. SINISTRADO/MEDIA MONTA CIRCUL VEDADA / **ATENÇÃO ** AO EFETUAR SEU LANCE";
const LOOP_OBS =
  "CHASSI APRESENTA OXIDAÇÃO / CORROSÃO ACENTUADA, PONTA DA LONGARINA DIANTEIRA DIREITA - REPARADO(A) / RECUPERADO(A)";
const LOOP_VISTORIA = "Funcionando/Ligando (Motor): Funciona";
const SOLD = "Motor: FUNCIONANDO. Veiculo Funcionando, Ar Condicionado Gelando. DPVAT (seguro obrigatório)";
const VIP = "Funcionando na Entrada: Não. Procedência: Patrimônio (Conservado)";

describe("condição com textos reais", () => {
  it("Freitas: média monta com circulação vedada → não apto", () => {
    const monta = classificarMonta(FREITAS);
    const circulacao = classificarCirculacao(FREITAS);
    expect(monta).toBe("media");
    expect(circulacao).toBe("vedada");
    expect(classificarProcedencia(FREITAS)).toBe("seguradora");
    expect(aptoRodar({ monta, roda: "nao_informado", circulacao, danoEstrutural: false })).toBe(false);
  });

  it("Loop: motor funciona, mas longarina e corrosão → dano estrutural", () => {
    expect(classificarRoda(LOOP_VISTORIA)).toBe("sim");
    expect(danosEstruturais(LOOP_OBS)).toEqual(expect.arrayContaining(["longarina", "corrosao acentuada"]));
  });

  it("Sold: motor funcionando; 'seguro obrigatório' não vira seguradora", () => {
    expect(classificarRoda(SOLD)).toBe("sim");
    expect(classificarProcedencia(SOLD)).toBe("nao_informado");
  });

  it("VIP: 'Funcionando na Entrada: Não' → não roda", () => {
    expect(classificarRoda(VIP)).toBe("nao");
    expect(classificarProcedencia(VIP)).toBe("patrimonio");
  });

  it("apto a rodar", () => {
    const base = { roda: "sim" as const, circulacao: "nao_informado" as const, danoEstrutural: false };
    expect(aptoRodar({ ...base, monta: "sem_monta" })).toBe(true);
    expect(aptoRodar({ ...base, monta: "pequena" })).toBe(true);
    expect(aptoRodar({ ...base, monta: "grande" })).toBe(false);
    expect(aptoRodar({ ...base, monta: "sucata" })).toBe(false);
    expect(aptoRodar({ ...base, monta: "sem_monta", danoEstrutural: true })).toBe(false);
  });
});
