import { mkdir, writeFile } from "node:fs/promises";
import type { Browser } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import { casarTermos, UFS_ALVO, type LoteColetado, type TermoBusca } from "@karv/core";
import { novoContexto, pausa, type Adapter } from "./base";
import { classificar, mereceAlertaNovo } from "./classificar";
import type { SiteRow } from "./db";
import { ufPorCidade } from "./municipios";
import { avisarFalha, avisarSumiu } from "./alertas";

export type Modo = "completo" | "favoritos";
const MAX_FOTOS = 8;

interface Prev {
  id: string;
  id_externo: string;
  lance_atual: number | null;
  status: string | null;
  fim_em: string | null;
}

export interface Resultado {
  slug: string;
  encontrados: number;
  candidatos: number;
  novos: number;
  atualizados: number;
  erro?: string;
}

const ufOk = (uf?: string) => !uf || (UFS_ALVO as readonly string[]).includes(uf);

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
}): Promise<Resultado> {
  const { browser, db, site, adapter, termos, modo, seco } = opts;
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

    const candidatos = coletados.filter(
      (l) =>
        ufOk(l.uf) &&
        !descartados.has(l.idExterno) &&
        (modo === "completo" || favoritos.has(l.idExterno)) &&
        casarTermos(l, termos).length > 0,
    );
    res.candidatos = candidatos.length;
    log(`${candidatos.length} casam com os termos`);

    const ids = candidatos.map((c) => c.idExterno);
    const { data: prevs } = ids.length
      ? await db
          .from("lotes")
          .select("id, id_externo, lance_atual, status, fim_em")
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
      if (!casados.length) continue;

      const linha = classificar(l);
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
        const { data, error } = await db
          .from("lotes")
          .insert({
            ...linha,
            site_id: site.id,
            id_externo: l.idExterno,
            fotos,
            alerta_pendente: mereceAlertaNovo(linha) ? "novo" : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        loteId = data.id;
        res.novos++;
      } else {
        const lanceMudou = Number(prev.lance_atual ?? 0) !== Number(linha.lance_atual ?? 0);
        // lote que passou a merecer alerta (ex.: classificação melhorou) entra na fila;
        // enviarPendentes confere alertas_enviados e não repete o "novo"
        const extra =
          lanceMudou && favoritos.has(l.idExterno)
            ? { alerta_pendente: "lance", lance_anterior: prev.lance_atual }
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
