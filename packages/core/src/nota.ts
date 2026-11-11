/**
 * Nota de oportunidade (0–100): o quanto o lote é um bom negócio para quem quer RODAR.
 * O peso maior é o preço (custo real ÷ FIPE); o resto mede risco e conveniência.
 * Devolve também o detalhamento por critério (para mostrar ao passar o mouse na nota).
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
  procedencia: string | null;
  chave: string;
  danoEstrutural: boolean;
  km: number | null;
  anoMod: number | null;
  distanciaKm: number | null;
  anoAtual?: number;
}

export interface ItemNota {
  criterio: string;
  pontos: number;
  max: number;
  detalhe: string;
}

const MONTA: Record<string, [number, string]> = {
  sem_monta: [20, "sem monta"],
  pequena: [12, "pequena monta"],
  nao_informado: [8, "não informada"],
  media: [3, "média monta"],
};
const PROCEDENCIA: Record<string, [number, string]> = {
  financiamento: [8, "financeira"],
  frota: [8, "frota"],
  patrimonio: [6, "patrimônio"],
  particular: [5, "particular"],
  judicial: [4, "judicial"],
  nao_informado: [4, "não informada"],
  apreensao: [3, "apreensão"],
  seguradora: [2, "seguradora"],
};

export function notaOportunidade(e: EntradaNota): { nota: number; motivos: string[]; itens: ItemNota[]; teto: number | null } {
  const motivos: string[] = [];
  const itens: ItemNota[] = [];
  const add = (criterio: string, pontos: number, max: number, detalhe: string) =>
    itens.push({ criterio, pontos: Math.round(pontos * 10) / 10, max, detalhe });

  // preço: 45 pontos, linear entre 95% (0) e 50% (45) da FIPE
  if (e.pctFipe != null && e.pctFipe > 0) {
    const provavel = e.pctProvavel != null && e.pctProvavel > e.pctFipe ? e.pctProvavel : null;
    const pct = provavel ?? e.pctFipe;
    const p = Math.max(0, Math.min(1, (0.95 - pct) / 0.45)) * 45;
    motivos.push(`${Math.round(e.pctFipe * 100)}% FIPE`);
    if (provavel) motivos.push(`deve fechar ~${Math.round(provavel * 100)}%`);
    add(
      "Preço (custo real ÷ FIPE)",
      p,
      45,
      provavel
        ? `agora ${Math.round(e.pctFipe * 100)}%, mas deve fechar ~${Math.round(provavel * 100)}%`
        : `${Math.round(e.pctFipe * 100)}% da FIPE (50% ou menos = 45)`,
    );
  } else {
    motivos.push("sem FIPE");
    add("Preço (custo real ÷ FIPE)", 15, 45, "sem FIPE: valor neutro");
  }

  const [pm, mm] = MONTA[e.monta] ?? [0, e.monta];
  if (pm !== 8 && pm) motivos.push(mm);
  add("Monta", pm, 20, mm);

  const pr = e.roda === "sim" ? 10 : e.roda === "nao_informado" ? 4 : 0;
  if (e.roda === "sim") motivos.push("motor funciona");
  add("Motor", pr, 10, e.roda === "sim" ? "funciona" : e.roda === "nao" ? "não funciona" : "não informado");

  const pc = e.circulacao === "liberada" ? 5 : 0;
  if (pc) motivos.push("em circulação");
  add("Documento / circulação", pc, 5, e.circulacao === "liberada" ? "liberado para rodar" : e.circulacao === "vedada" ? "circulação vedada" : "não informado");

  const [pp, mp] = PROCEDENCIA[e.procedencia ?? "nao_informado"] ?? [4, "não informada"];
  if (pp >= 6 || pp === 2) motivos.push(mp);
  add("Procedência", pp, 8, mp);

  const anoAtual = e.anoAtual ?? new Date().getFullYear();
  if (e.anoMod) {
    const idade = Math.max(1, anoAtual - e.anoMod + 1);
    add("Idade", idade <= 8 ? 4 : 0, 4, `${idade} ano${idade > 1 ? "s" : ""} (até 8 = 4)`);
    if (e.km != null && e.km > 0) {
      const kmAno = e.km / idade;
      const pk = kmAno <= 15_000 ? 6 : kmAno <= 25_000 ? 3 : 0;
      if (pk === 6) motivos.push("km baixo");
      if (!pk) motivos.push("km alto");
      add("Km por ano", pk, 6, `${Math.round(kmAno / 1000)} mil km/ano`);
    } else add("Km por ano", 2, 6, "km não informado");
  } else {
    add("Idade", 0, 4, "ano não informado");
    add("Km por ano", 0, 6, "ano não informado");
  }

  if (e.distanciaKm != null) {
    motivos.push(`${e.distanciaKm} km de você`);
    add("Distância", e.distanciaKm <= 300 ? 6 : e.distanciaKm <= 600 ? 3 : 0, 6, `${e.distanciaKm} km (até 300 = 6)`);
  } else add("Distância", 2, 6, "não calculada");

  if (e.chave === "nao") motivos.push("sem chave");
  add("Chave", e.chave === "sim" ? 2 : e.chave === "nao" ? -3 : 0, 2, e.chave === "sim" ? "tem chave" : e.chave === "nao" ? "sem chave (−3)" : "não informado");

  let n = itens.reduce((s, i) => s + i.pontos, 0);
  let teto: number | null = null;
  if (e.danoEstrutural) {
    teto = 20;
    n = Math.min(n, 20);
    motivos.push("dano estrutural");
  }
  return { nota: Math.max(0, Math.min(100, Math.round(n))), motivos, itens, teto };
}
