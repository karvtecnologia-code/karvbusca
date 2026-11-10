import { describe, expect, it } from "vitest";
import { mereceAlertaNovo } from "../src/classificar";

const base = {
  apto_rodar: true,
  roda: "nao_informado",
  circulacao: "nao_informado",
  status: "aberto",
  procedencia: "nao_informado",
} as const;

describe("regra do alerta de lote novo", () => {
  it("apto com sinal positivo do site → alerta", () => {
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta" })).toBe(true);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "pequena" })).toBe(true);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "nao_informado", roda: "sim" })).toBe(true);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "nao_informado", circulacao: "liberada" })).toBe(true);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "media", roda: "sim" })).toBe(true);
  });
  it("sem nenhuma informação (judicial sem descrição) → só painel", () => {
    expect(mereceAlertaNovo({ ...base, condicao_monta: "nao_informado" })).toBe(false);
  });
  it("Copart: batida de seguradora aguardando classificação → só painel, mesmo com motor ok", () => {
    expect(
      mereceAlertaNovo({ ...base, condicao_monta: "nao_informado", roda: "sim", procedencia: "seguradora" }),
    ).toBe(false);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "pequena", roda: "sim", procedencia: "seguradora" })).toBe(true);
  });
  it("não aptos, motor parado ou estoque 'Em breve' → sem alerta", () => {
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta", roda: "nao" })).toBe(false);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sucata", apto_rodar: false })).toBe(false);
    expect(mereceAlertaNovo({ ...base, condicao_monta: "sem_monta", status: "estoque" })).toBe(false);
  });
});
