import type { SupabaseClient } from "@supabase/supabase-js";
import { Fipe, normalizar, type ResultadoFipe } from "@karv/core";

const UM_MES = 30 * 24 * 3600 * 1000;

export interface ConsultaFipe {
  tipo?: "carro" | "moto" | null;
  marca?: string | null;
  modelo?: string | null;
  versao?: string | null;
  titulo: string;
  anoMod?: number | null;
  combustivel?: string | null;
}

/**
 * FIPE com cache persistente (tabela fipe_cache) por modelo/ano: muitos lotes repetem o mesmo
 * carro, e a API gratuita tem limite de 1000 consultas/dia. `orcamento` limita consultas novas.
 */
export class FipeCache {
  private api = new Fipe();
  constructor(
    private db: SupabaseClient,
    public orcamento = 60,
  ) {}

  get consultas() {
    return this.api.consultas;
  }

  private chave(l: ConsultaFipe) {
    return [l.tipo ?? "", l.marca ?? "", `${l.modelo ?? ""} ${l.versao ?? ""}`.trim() || l.titulo, l.anoMod ?? "", l.combustivel ?? ""]
      .map((x) => normalizar(String(x)))
      .join("|");
  }

  async buscar(l: ConsultaFipe): Promise<ResultadoFipe | null> {
    if (!l.anoMod) return null;
    const chave = this.chave(l);
    const { data: c } = await this.db.from("fipe_cache").select("*").eq("chave", chave).maybeSingle();
    if (c && Date.now() - new Date(c.atualizado_em).getTime() < UM_MES) {
      return c.valor ? { codigo: c.codigo, valor: Number(c.valor), modelo: "", ano: "", aproximada: c.aproximada } : null;
    }
    if (this.orcamento <= 0) return null; // sem orçamento nesta execução: fica para a próxima
    this.orcamento--;
    const r = await this.api.buscar(l);
    await this.db.from("fipe_cache").upsert({
      chave,
      codigo: r?.codigo ?? null,
      valor: r?.valor ?? null,
      aproximada: r?.aproximada ?? null,
      atualizado_em: new Date().toISOString(),
    });
    return r;
  }

  porCodigo(codigo: string, anoMod: number, moto: boolean, combustivel?: string) {
    return this.api.porCodigo(codigo, anoMod, moto, combustivel);
  }
}

/** Preenche/atualiza a FIPE dos lotes ainda abertos (1 vez por mês por lote). */
export async function atualizarFipe(db: SupabaseClient, fipe: FipeCache, log = console.log, limite = 120) {
  const corte = new Date(Date.now() - UM_MES).toISOString();
  const { data, error } = await db
    .from("lotes")
    .select("id, tipo, marca, modelo, versao, titulo, ano_mod, ano_fab, combustivel, fipe_codigo, fipe_aproximada, fipe_site")
    .or(`fipe_atualizado_em.is.null,fipe_atualizado_em.lt.${corte}`)
    .or(`fim_em.is.null,fim_em.gte.${new Date(Date.now() - 86400_000).toISOString()}`)
    .limit(limite);
  if (error) throw error;

  let ok = 0;
  for (const l of data ?? []) {
    const anoMod = l.ano_mod ?? l.ano_fab;
    try {
      // código corrigido à mão no painel tem prioridade
      const r =
        l.fipe_codigo && !l.fipe_aproximada && anoMod
          ? await fipe.porCodigo(l.fipe_codigo, anoMod, l.tipo === "moto", l.combustivel ?? undefined)
          : await fipe.buscar({ ...l, anoMod });
      if (!r && fipe.orcamento <= 0) break; // acabou o orçamento: não marca como tentado
      await db
        .from("lotes")
        .update({
          fipe_atualizado_em: new Date().toISOString(),
          ...(r ? { fipe_codigo: r.codigo, fipe_valor: r.valor, fipe_aproximada: r.aproximada } : {}),
        })
        .eq("id", l.id);
      if (r) ok++;
    } catch (e) {
      log(`[fipe] ${l.titulo}: ${(e as Error).message}`);
      if (/HTTP 429/.test((e as Error).message)) break; // limite diário da API
    }
  }
  log(`[fipe] ${ok}/${data?.length ?? 0} lotes com FIPE (${fipe.consultas} consultas à API)`);
}
