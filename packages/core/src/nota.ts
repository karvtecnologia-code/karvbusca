/**
 * Nota de oportunidade (0–100): o quanto o lote é um bom negócio para quem quer RODAR.
 * O peso maior é o preço (custo real ÷ FIPE); o resto mede risco e conveniência.
 */
export interface EntradaNota {
  pctFipe: number | null; // custo real ÷ FIPE (0,62 = 62%)
  /**
   * Quanto este modelo costuma FECHAR em relação à FIPE (mediana dos encerrados, já com o
   * acréscimo de taxas do lote). Um lance baixo no começo do leilão engana: a nota usa o
   * maior entre o custo de agora e o custo provável no fechamento.
   */
  pctProvavel?: number | null;
  monta: string;
  roda: string;
  circulacao: string;
  procedencia: string;
  chave: string;
  danoEstrutural: boolean;
  km: number | null;
  anoMod: number | null;
  distanciaKm: number | null;
  anoAtual?: number;
}

const MONTA: Record<string, [number, string | null]> = {
  sem_monta: [20, "sem monta"],
  pequena: [12, "pequena monta"],
  nao_informado: [8, null],
  media: [3, "média monta"],
};
const PROCEDENCIA: Record<string, [number, string | null]> = {
  financiamento: [8, "financeira"],
  frota: [8, "frota"],
  patrimonio: [6, "patrimônio"],
  judicial: [4, null],
  apreensao: [3, null],
  seguradora: [2, "seguradora"],
  nao_informado: [4, null],
  particular: [5, null],
};

export function notaOportunidade(e: EntradaNota): { nota: number; motivos: string[] } {
  const motivos: string[] = [];
  let n = 0;

  // preço: 45 pontos, linear entre 95% (0) e 50% (45) da FIPE
  if (e.pctFipe != null && e.pctFipe > 0) {
    const provavel = e.pctProvavel != null && e.pctProvavel > e.pctFipe ? e.pctProvavel : null;
    const pct = provavel ?? e.pctFipe;
    n += Math.max(0, Math.min(1, (0.95 - pct) / 0.45)) * 45;
    motivos.push(`${Math.round(e.pctFipe * 100)}% FIPE`);
    if (provavel) motivos.push(`deve fechar ~${Math.round(provavel * 100)}%`);
  } else {
    n += 15; // sem FIPE: neutro
    motivos.push("sem FIPE");
  }

  const [pm, mm] = MONTA[e.monta] ?? [0, null];
  n += pm;
  if (mm) motivos.push(mm);

  n += e.roda === "sim" ? 10 : e.roda === "nao_informado" ? 4 : 0;
  if (e.roda === "sim") motivos.push("motor funciona");

  if (e.circulacao === "liberada") {
    n += 5;
    motivos.push("em circulação");
  }

  const [pp, mp] = PROCEDENCIA[e.procedencia] ?? [4, null];
  n += pp;
  if (mp) motivos.push(mp);

  const anoAtual = e.anoAtual ?? new Date().getFullYear();
  if (e.anoMod) {
    const idade = Math.max(1, anoAtual - e.anoMod + 1);
    if (idade <= 8) n += 4;
    if (e.km != null && e.km > 0) {
      const kmAno = e.km / idade;
      if (kmAno <= 15_000) {
        n += 6;
        motivos.push("km baixo");
      } else if (kmAno <= 25_000) n += 3;
      else motivos.push("km alto");
    } else n += 2;
  }

  if (e.distanciaKm != null) {
    n += e.distanciaKm <= 300 ? 6 : e.distanciaKm <= 600 ? 3 : 0;
    motivos.push(`${e.distanciaKm} km de você`);
  } else n += 2;

  if (e.chave === "sim") n += 2;
  if (e.chave === "nao") {
    n -= 3;
    motivos.push("sem chave");
  }

  if (e.danoEstrutural) {
    n = Math.min(n, 20);
    motivos.push("dano estrutural");
  }
  return { nota: Math.max(0, Math.min(100, Math.round(n))), motivos };
}
