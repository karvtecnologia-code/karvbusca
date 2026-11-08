import * as cheerio from "cheerio";
import { anos, dataBR, dinheiro, inteiro, normalizar, UFS_ALVO, type LoteColetado } from "@karv/core";
import { abrir, campo, linhas, pausa, textoVisivel, type Adapter } from "../base";

const BASE = "https://www.vipleiloes.com.br";
const MAX_PAGINAS = 20;

/** Lê os cards da resposta de /pesquisa?handler=pesquisar (HTML parcial). */
export function parseVipLista(html: string): LoteColetado[] {
  const $ = cheerio.load(html);
  const out: LoteColetado[] = [];
  $(".card-anuncio").each((_, el) => {
    const c = $(el);
    const href = c.find("a.anc-body").attr("href") ?? c.find("a[href*='/evento/anuncio/']").attr("href");
    const id = href?.match(/-(\d+)$/)?.[1];
    if (!href || !id) return;
    const h1 = c.find(".anc-title h1").text().trim(); // "PALIO ELX FLEX - 2005/2006"
    const info = c.find(".anc-info span").map((_, s) => $(s).text().trim()).get();
    const marca = info[0] || undefined;
    const [anoFab, anoMod] = anos(h1);
    const local = c.find(".anc-local").text().replace(/\s+/g, " ");
    const uf = local.match(/Local:\s*([A-Z]{2})/)?.[1];
    const inicio = c.find(".anc-start").text().match(/(\d{2}\/\d{2}\/\d{4})/)?.[1];
    const hora = c.find(".anc-hour").text().trim();
    const modelo = h1.replace(/\s*-\s*\d{2,4}\s*\/\s*\d{2,4}\s*$/, "").trim();
    out.push({
      site: "vip",
      idExterno: id,
      url: BASE + href,
      titulo: [marca?.toUpperCase(), modelo].filter(Boolean).join(" "),
      marca,
      modelo,
      anoFab,
      anoMod,
      uf,
      lanceAtual: dinheiro(c.find(".valor-atual").text()),
      lanceInicial: dinheiro(c.find(".anc-lel b").text()),
      fimEm: dataBR(inicio, hora),
      status: c.find(".situacao").text().trim() || undefined,
      fotos: [c.find(".crd-image img").attr("src")].filter(Boolean) as string[],
      raw: { href, h1, info, local },
    });
  });
  return out;
}

/** Lê a página de detalhe (texto visível). */
export function parseVipDetalhe(texto: string, lote: LoteColetado): LoteColetado {
  const ls = linhas(texto);
  const funcionando = campo(ls, "Funcionando na Entrada");
  const chave = campo(ls, "Chave");
  const procedencia = campo(ls, "Procedência");
  const local = campo(ls, "Localização"); // "..., SÃO LUÍS, MA - CEP: 65095602"
  const loc = local?.match(/,\s*([^,]+),\s*([A-Z]{2})\s*-\s*CEP/i);
  const obs = campo(ls, "Observações");
  const veiculo = campo(ls, "Veículo"); // "HONDA - XRE 300"
  const tipoVeic = /moto/i.test(campo(ls, "Tipo") ?? "") ? "moto" : undefined;
  return {
    ...lote,
    titulo: veiculo ? veiculo.replace(/\s*-\s*/, " ") : lote.titulo,
    tipo: tipoVeic ?? lote.tipo,
    km: inteiro(campo(ls, "KM")) ?? lote.km,
    combustivel: campo(ls, "Combustível") ?? lote.combustivel,
    cidade: loc?.[1]?.trim() ?? lote.cidade,
    uf: loc?.[2]?.toUpperCase() ?? lote.uf,
    condicaoTexto: [
      procedencia,
      funcionando ? `funcionando na entrada ${funcionando}` : null,
    ]
      .filter(Boolean)
      .join(" . "),
    observacoes: obs,
    chave: chave && chave !== "--" ? (/^sim/i.test(chave) ? "sim" : "nao") : lote.chave,
    procedenciaTexto: [procedencia, campo(ls, "Comitente")].filter(Boolean).join(" . "),
  };
}

export const vip: Adapter = {
  slug: "vip",
  async listar({ page, termos, log }) {
    await abrir(page, `${BASE}/pesquisa`);
    // busca por termo e UF direto no formulário do site (bem menos páginas que varrer tudo)
    const textos = [...new Set(termos.filter((t) => t.ativo).flatMap((t) => [t.termo, ...t.apelidos]))];
    const vistos = new Map<string, LoteColetado>();
    const jaBuscado = new Set<string>();
    let tentativas = 0;

    // a página já dispara uma busca ao abrir; esperamos antes da nossa
    await pausa(4000, 7000);

    for (const texto of textos) {
      // "hr-v" e "hr v" viram a mesma busca, mas "hrv" continua separada (o site busca por texto)
      const chave = normalizar(texto);
      if (jaBuscado.has(chave)) continue;
      jaBuscado.add(chave);
      for (const uf of UFS_ALVO) {
        for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
          const html = await page.evaluate(
            async ({ texto, uf, pagina }) => {
              const token =
                (document.querySelector("input[name=__RequestVerificationToken]") as HTMLInputElement | null)
                  ?.value ?? "";
              const body = new URLSearchParams({
                "Filtro.Texto": texto,
                "Filtro.LocalEstadoId": uf,
                "Filtro.CurrentPage": String(pagina),
                "Filtro.OrdenarPor": "DataInicio",
                "Filtro.SomenteDestaques": "False",
                "Filtro.SelecaoVeiculos": "false",
                "Filtro.SelecaoOutros": "false",
                "Filtro.Financiavel": "false",
                __RequestVerificationToken: token,
              });
              const r = await fetch("/pesquisa?handler=pesquisar", {
                method: "POST",
                headers: {
                  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                  "x-requested-with": "XMLHttpRequest",
                  RequestVerificationToken: token,
                },
                body,
              });
              if (r.status === 429) return "__429__";
              if (!r.ok) throw new Error(`pesquisar HTTP ${r.status}`);
              return r.text();
            },
            { texto, uf, pagina },
          );
          if (html === "__429__") {
            // limite de requisições: espera e tenta a mesma página de novo (no máximo 3 vezes)
            tentativas++;
            if (tentativas > 3) throw new Error("VIP: HTTP 429 (limite de requisições) mesmo após esperar");
            log(`429 recebido, esperando ${30 * tentativas}s`);
            await pausa(30_000 * tentativas, 30_000 * tentativas + 5000);
            pagina--;
            continue;
          }
          tentativas = 0;
          const cards = parseVipLista(html);
          const novos = cards.filter((c) => !vistos.has(c.idExterno));
          for (const c of cards) vistos.set(c.idExterno, c);
          log(`"${texto}" ${uf} p${pagina}: ${cards.length} cards`);
          await pausa();
          if (!cards.length || !novos.length) break;
        }
      }
    }
    return [...vistos.values()];
  },
  async detalhar({ page }, lote) {
    await abrir(page, lote.url);
    return parseVipDetalhe(await textoVisivel(page), lote);
  },
};
