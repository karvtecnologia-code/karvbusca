import { describe, expect, it } from "vitest";
import { mereceAlertaNovo } from "../src/classificar";

const base = { apto_rodar: true, roda: "nao_informado", circulacao: "nao_informado", status: "aberto" } as const;

describe("regra do alerta de lote novo", () => {
  it("sem monta / pequena monta aptos → alerta", () => {
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta" })).toBe(true);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "pequena" })).toBe(true);
  });
  it("Sold: monta não informada, mas 'em circulação' → alerta", () => {
    expect(mereceAlertaNovo({ ...base, condicao_monta: "nao_informado", circulacao: "liberada" })).toBe(true);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "nao_informado" })).toBe(false);
  });
  it("média monta, motor parado, não apto ou estoque → sem alerta", () => {
    expect(mereceAlertaNovo({ ...base, condicao_monta: "media" })).toBe(false);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta", roda: "nao" })).toBe(false);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta", apto_rodar: false })).toBe(false);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta", status: "estoque" })).toBe(false);
  });
});
