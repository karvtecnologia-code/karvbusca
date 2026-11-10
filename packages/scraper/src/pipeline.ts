import { mkdir, writeFile } from "node:fs/promises";
import type { Browser } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import { casarTermos, classificarMonta, normalizar, type LoteColetado, type TermoBusca } from "@karv/core";
import { ufOk } from "./ufs";
import { novoContexto, pausa, type Adapter } from "./base";
import { classificar, mereceAlertaNovo } from "./classificar";
import type { SiteRow } from "./db";
import type { FipeCache } from "./fipe";
import { ufPorCidade } from "./municipios";
import { avisarFalha, avisarSumiu } from "./alertas";

export type Modo = "completo" | "favoritos";
const MAX_FOTOS = 8;

interface Prev {
  id: string;
  id_externo: string;
  lance_atual: number | null;
  lance_inicial: number | null;
  status: string | null;
  fim_em: string | null;
}

export interface OpcoesDescoberta {
  fipe: FipeCache;
  pctMax: number; // lance ÷ FIPE máximo (0,65)
  anoMin: number;
  maxPorSite: number; // quantos achados viram candidatos por site/execução
  maxAvaliados: number; // quantos passam pela checagem de FIPE por site/execução
}

/** Identifica o mesmo carro em leilões diferentes (relistado). Sem km não dá para afirmar. */
export function chaveVeiculo(l: LoteColetado): string | null {
  if (!l.km || l.km < 100) return null;
  const modelo = normalizar(l.modelo ?? l.titulo).split(" ").slice(0, 2).join(" ");
  return [normalizar(l.marca ?? ""), modelo, l.anoMod ?? l.anoFab ?? "", l.km].join("|");
}

/**
 * Modo descoberta: entre os lotes que NÃO casam com os termos, acha os baratos em relação à FIPE.
 * Filtra primeiro pelo que é barato verificar (UF, ano, lance, monta no texto da listagem) e só
 * então consulta a FIPE (com cache), respeitando um limite por site para caber no plano gratuito.
 */
async function achar(
  coletados: LoteColetado[],
  porTermo: LoteColetado[],
  descartados: Set<string>,
  termos: TermoBusca[],
  o: OpcoesDescoberta,
  db: SupabaseClient,
  site: SiteRow,
  log: (m: string) => void,
): Promise<LoteColetado[]> {
  const jaPorTermo = new Set(porTermo.map((l) => l.idExterno));
  // achados de execuções anteriores continuam sendo acompanhados (lance, status)
  const { data: antigos } = await db
    .from("lotes")
    .select("id_externo")
    .eq("site_id", site.id)
    .eq("descoberta", true)
    .gt("fim_em", new Date().toISOString());
  const acompanhar = new Set((antigos ?? []).map((a) => a.id_externo));

  const pre = coletados
    .filter(
      (l) =>
        !jaPorTermo.has(l.idExterno) &&
        !descartados.has(l.idExterno) &&
        ufOk(l.uf) &&
        l.status !== "estoque" &&
        (l.lanceAtual ?? 0) > 0 &&
        (l.anoMod ?? l.anoFab ?? 0) >= o.anoMin &&
        casarTermos(l, termos).length === 0 &&
        !["sucata", "grande"].includes(classificarMonta(l.condicaoTexto, l.titulo, l.observacoes)),
    )
    .sort((a, b) => (b.anoMod ?? b.anoFab ?? 0) - (a.anoMod ?? a.anoFab ?? 0)); // mais novos primeiro

  const achados: { l: LoteColetado; pct: number }[] = [];
  let avaliados = 0;
  for (const l of pre) {
    if (acompanhar.has(l.idExterno)) {
      achados.push({ l, pct: 0 });
      continue;
    }
    if (avaliados >= o.maxAvaliados) continue;
    avaliados++;
    const fipe =
      l.fipeSite ??
      (await o.fipe.buscar({ tipo: l.tipo, marca: l.marca, modelo: l.modelo, versao: l.versao, titulo: l.titulo, anoMod: l.anoMod ?? l.anoFab, combustivel: l.combustivel }))?.valor;
    if (!fipe) continue;
    const pct = (l.lanceAtual ?? 0) / fipe;
    if (pct <= o.pctMax) achados.push({ l, pct });
  }
  achados.sort((a, b) => a.pct - b.pct);
  const novos = achados.filter((a) => !acompanhar.has(a.l.idExterno)).slice(0, o.maxPorSite);
  const final = [...achados.filter((a) => acompanhar.has(a.l.idExterno)), ...novos].map((a) => a.l);
  log(`descoberta: ${pre.length} fora dos termos, ${avaliados} avaliados na FIPE, ${novos.length} novos achados + ${acompanhar.size} acompanhados`);
  return final;
}

export interface Resultado {
  slug: string;
  encontrados: number;
  candidatos: number;
  novos: number;
  atualizados: number;
  erro?: string;
}


async function copiarFotos(db: SupabaseClient, l: LoteColetado): Promise<string[]> {
  const out: string[] = [];
  for (const [i, url] of l.fotos.slice(0, MAX_FOTOS).entries()) {
    try {
      const r = await fetch(url, { headers: { referer: new URL(l.url).origin + "/" } });
      if (!r.ok) throw new Error(String(r.status));
      const tipo = r.headers.get("content-type") ?? "image/jpeg";
      const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
      const caminho = `${l.site}/${l.idExterno}/${i}.${ext}`;
      const { error } = await db.storage
        .from("fotos")
        .upload(caminho, Buffer.from(await r.arrayBuffer()), { contentType: tipo, upsert: true });
      if (error) throw error;
      out.push(db.storage.from("fotos").getPublicUrl(caminho).data.publicUrl);
    } catch {
      out.push(url); // mantém o link original se a cópia falhar
    }
  }
  return out;
}

export async function rodarSite(opts: {
  browser: Browser;
  db: SupabaseClient;
  site: SiteRow;
  adapter: Adapter;
  termos: TermoBusca[];
  modo: Modo;
  seco?: boolean;
  descoberta?: OpcoesDescoberta | null;
}): Promise<Resultado> {
  const { browser, db, site, adapter, termos, modo, seco, descoberta } = opts;
  const logs: string[] = [];
  const log = (m: string) => {
    const linha = `[${site.slug}] ${m}`;
    logs.push(linha);
    console.log(linha);
  };
  const res: Resultado = { slug: site.slug, encontrados: 0, candidatos: 0, novos: 0, atualizados: 0 };
  const inicio = new Date().toISOString();
  const ctx = await novoContexto(browser);
  const page = await ctx.newPage();

  try {
    // decisões do site: descartados nunca voltam; favoritos recebem alerta de lance
    const { data: dec } = await db.from("decisoes").select("id_externo, decisao").eq("site_id", site.id);
    const descartados = new Set(dec?.filter((d) => d.decisao === "descartado").map((d) => d.id_externo));
    const favoritos = new Set(dec?.filter((d) => d.decisao === "gostei").map((d) => d.id_externo));
    if (modo === "favoritos" && !favoritos.size) {
      log("sem favoritos neste site, pulando");
      return res;
    }

    const coletados = await adapter.listar({ page, termos, log });
    res.encontrados = coletados.length;
    log(`${coletados.length} lotes na listagem`);

    const porTermo = coletados.filter(
      (l) =>
        ufOk(l.uf) &&
        !descartados.has(l.idExterno) &&
        (modo === "completo" || favoritos.has(l.idExterno)) &&
        casarTermos(l, termos).length > 0,
    );
    log(`${porTermo.length} casam com os termos`);

    // modo descoberta: qualquer veículo fora dos termos, barato em relação à FIPE
    const descobertos = descoberta && modo === "completo" ? await achar(coletados, porTermo, descartados, termos, descoberta, db, site, log) : [];
    const idsDescoberta = new Set(descobertos.map((d) => d.idExterno));
    const candidatos = [...porTermo, ...descobertos];
    res.candidatos = candidatos.length;

    const ids = candidatos.map((c) => c.idExterno);
    const { data: prevs } = ids.length
      ? await db
          .from("lotes")
          .select("id, id_externo, lance_atual, lance_inicial, status, fim_em")
          .eq("site_id", site.id)
          .in("id_externo", ids)
      : { data: [] as Prev[] };
    const anteriores = new Map((prevs as Prev[]).map((p) => [p.id_externo, p]));
    let detalhesFalhos = 0;

    for (const base of candidatos) {
      let l = base;
      if (adapter.detalhar) {
        try {
          const antes = page.url();
          l = await adapter.detalhar({ page, termos, log }, base);
          if (page.url() !== antes) await pausa(); // só pausa se abriu página
        } catch (e) {
          // sem o detalhe não sabemos a condição: não grava agora, tenta na próxima busca
          log(`detalhe falhou (${base.idExterno}), fica para a próxima: ${(e as Error).message}`);
          detalhesFalhos++;
          continue;
        }
      }
      if (!l.uf && l.cidade) l = { ...l, uf: await ufPorCidade(l.cidade) };
      if (!ufOk(l.uf)) continue; // UF só conhecida no detalhe (Sold, VIP)
      const casados = casarTermos(l, termos);
      const ehDescoberta = idsDescoberta.has(l.idExterno);
      if (!casados.length && !ehDescoberta) continue;

      const linha = { ...classificar(l), chave_veiculo: chaveVeiculo(l) };
      // descoberta só interessa se, com o detalhe, continuar apto a rodar
      if (ehDescoberta && !casados.length && !linha.apto_rodar) continue;
      const prev = anteriores.get(l.idExterno);
      const agora = new Date().toISOString();

      if (seco) {
        log(
          `${prev ? "atualiza" : "NOVO"} ${l.idExterno} ${l.titulo} | ${l.uf} | ${linha.condicao_monta}/${linha.roda}` +
            ` | circ=${linha.circulacao} danos=[${linha.dano_detalhe.join(",")}]` +
            ` | apto=${linha.apto_rodar} | alerta=${!prev && mereceAlertaNovo(linha)}` +
            ` | ${(l.condicaoTexto ?? "").slice(0, 80)}`,
        );
        prev ? res.atualizados++ : res.novos++;
        continue;
      }

      let loteId: string;
      const mudou =
        !prev ||
        Number(prev.lance_atual ?? 0) !== Number(linha.lance_atual ?? 0) ||
        prev.status !== linha.status ||
        (prev.fim_em && linha.fim_em ? new Date(prev.fim_em).getTime() !== new Date(linha.fim_em).getTime() : prev.fim_em !== linha.fim_em);

      if (!prev) {
        const fotos = await copiarFotos(db, l);
        // relistado: o mesmo carro (marca, modelo, ano e km) já esteve num leilão encerrado
        const anterior = linha.chave_veiculo
          ? (
              await db
                .from("lotes")
                .select("id, lance_atual")
                .eq("chave_veiculo", linha.chave_veiculo)
                .lt("fim_em", new Date().toISOString())
                .order("fim_em", { ascending: false })
                .limit(1)
            ).data?.[0]
          : undefined;
        const { data, error } = await db
          .from("lotes")
          .insert({
            ...linha,
            site_id: site.id,
            id_externo: l.idExterno,
            fotos,
            descoberta: ehDescoberta && !casados.length,
            relistado_de: anterior?.id ?? null,
            lance_anterior_relist: anterior?.lance_atual ?? null,
            alerta_pendente: mereceAlertaNovo(linha) ? (anterior ? "relistado" : "novo") : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        loteId = data.id;
        res.novos++;
      } else {
        const lanceMudou = Number(prev.lance_atual ?? 0) !== Number(linha.lance_atual ?? 0);
        // 2ª praça: o lance mínimo caiu pelo menos 5%
        const segundaPraca =
          linha.lance_inicial != null &&
          prev.lance_inicial != null &&
          Number(linha.lance_inicial) < Number(prev.lance_inicial) * 0.95;
        // prioridade: lance do favorito > 2ª praça > lote que passou a merecer alerta
        // (enviarPendentes confere alertas_enviados e não repete o "novo")
        const extra =
          lanceMudou && favoritos.has(l.idExterno)
            ? { alerta_pendente: "lance", lance_anterior: prev.lance_atual }
            : segundaPraca && linha.apto_rodar
              ? { alerta_pendente: "segunda_praca", lance_inicial_anterior: prev.lance_inicial }
              : mereceAlertaNovo(linha) && !favoritos.has(l.idExterno)
                ? { alerta_pendente: "novo" }
                : {};
        const { error } = await db
          .from("lotes")
          .update({ ...linha, ...extra, visto_ultimo_em: agora })
          .eq("id", prev.id);
        if (error) throw error;
        loteId = prev.id;
        res.atualizados++;
      }

      if (mudou) {
        await db
          .from("lotes_historico")
          .insert({ lote_id: loteId, lance_atual: linha.lance_atual, status: linha.status, fim_em: linha.fim_em });
      }
      if (casados.length)
        await db
          .from("lote_termos")
          .upsert(casados.map((t) => ({ lote_id: loteId, termo_id: t.id })), { ignoreDuplicates: true });
    }

    // favoritos ainda abertos que sumiram da listagem (só em busca completa e listagem saudável)
    if (!seco && modo === "completo" && coletados.length > 0 && favoritos.size) {
      const vistosAgora = new Set(coletados.map((c) => c.idExterno));
      const sumidos = [...favoritos].filter((id) => !vistosAgora.has(id));
      if (sumidos.length) {
        const { data: fav } = await db
          .from("lotes")
          .select("id, site_id, titulo, url, fim_em, status")
          .eq("site_id", site.id)
          .in("id_externo", sumidos)
          .gt("fim_em", new Date(Date.now() + 30 * 60_000).toISOString());
        for (const f of fav ?? []) {
          if (f.status === "retirado") continue;
          log(`favorito sumiu da listagem: ${f.titulo}`);
          await avisarSumiu(db, { ...f, site: site.nome }).catch((e) => log(`aviso sumiu falhou: ${(e as Error).message}`));
        }
      }
    }

    if (res.encontrados === 0) res.erro = "0 lotes na listagem (site mudou ou bloqueou?)";
    else if (candidatos.length && detalhesFalhos === candidatos.length)
      res.erro = `todas as ${detalhesFalhos} páginas de detalhe falharam (bloqueio ou limite do site?)`;
  } catch (e) {
    res.erro = (e as Error).message;
    log(`ERRO: ${res.erro}`);
    await mkdir("artifacts", { recursive: true });
    const nome = `artifacts/${site.slug}-${Date.now()}`;
    await page.screenshot({ path: `${nome}.png`, fullPage: true }).catch(() => {});
    await writeFile(`${nome}.html`, await page.content().catch(() => "")).catch(() => {});
  } finally {
    await ctx.close();
  }

  if (!seco) {
    await db.from("execucoes_robo").insert({
      site_id: site.id,
      modo,
      inicio,
      fim: new Date().toISOString(),
      encontrados: res.encontrados,
      novos: res.novos,
      atualizados: res.atualizados,
      erro: res.erro ?? null,
      log: logs.join("\n").slice(-20000),
    });
    if (modo === "completo") {
      const falhas = res.erro ? site.falhas_seguidas + 1 : 0;
      await db
        .from("sites")
        .update({
          ultima_execucao: new Date().toISOString(),
          status: res.erro ? (res.encontrados === 0 ? "vazio" : "erro") : "ok",
          falhas_seguidas: falhas,
        })
        .eq("id", site.id);
      // avisa uma vez, quando chega a 2 falhas seguidas (não repete a cada execução)
      if (falhas === 2) {
        log("2 falhas seguidas: avisando no Telegram");
        await avisarFalha(db, site, res.erro ?? "erro desconhecido").catch((e) =>
          log(`não consegui avisar no Telegram: ${(e as Error).message}`),
        );
      }
    }
  }
  return res;
}
