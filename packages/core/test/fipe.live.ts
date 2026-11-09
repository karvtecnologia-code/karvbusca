// Teste manual contra a API real: pnpm tsx test/fipe.live.ts
import { Fipe } from "../src/fipe";

const f = new Fipe();
for (const l of [
  { titulo: "HONDA - HR-V EX CVT", marca: "honda", modelo: "hr-v ex cvt", anoMod: 2017, tipo: "carro" as const },
  { titulo: "MITSUBISHI - ASX 2.0 CVT", marca: "mitsubishi", modelo: "asx 2.0 cvt", anoMod: 2015, tipo: "carro" as const },
  { titulo: "MMC ASX 2.0", marca: "MMC", modelo: "ASX 2.0", anoMod: 2014, tipo: "carro" as const },
  { titulo: "MITSUBISHI - OUTLANDER 2.4 4WD", marca: "mitsubishi", modelo: "outlander 2.4 4wd", anoMod: 2014, tipo: "carro" as const },
  { titulo: "HONDA - NXR 160 BROS", marca: "honda", modelo: "nxr 160 bros", anoMod: 2019, tipo: "moto" as const },
]) {
  console.log(l.titulo, "→", await f.buscar(l).catch((e) => String(e)));
}
console.log("consultas:", f.consultas);
