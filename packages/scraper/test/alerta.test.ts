import { describe, expect, it } from "vitest";
import { mereceAlertaNovo } from "../src/classificar";

const base = { apto_rodar: true, roda: "nao_informado", circulacao: "nao_informado", status: "aberto" } as const;

describe("regra do alerta de lote novo: todo lote apto (o que aparece na aba Lotes)", () => {
  it("aptos geram alerta, com qualquer monta que o deixe apto", () => {
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta" })).toBe(true);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "pequena" })).toBe(true);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "nao_informado" })).toBe(true);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "media", roda: "sim" })).toBe(true);
  });
  it("não aptos, motor parado ou estoque 'Em breve' → sem alerta", () => {
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta", roda: "nao" })).toBe(false);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sucata", apto_rodar: false })).toBe(false);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta", status: "estoque" })).toBe(false);
  });
});
