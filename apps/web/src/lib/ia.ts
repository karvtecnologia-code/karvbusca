import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { anosFmt, kmFmt, MONTA, PROCEDENCIA, quando, reais, RODA, valoresLote, type LotePainel } from "./lotes";

export interface AnaliseIA {
  veredito: "vale_a_pena" | "talvez" | "evitar";
  resumo: string;
  pontos_fortes: string[];
  pontos_atencao: string[];
  perguntas_vistoria: string[];
  lance_maximo_sugerido: number | null;
}

type Conteudo = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
interface Mensagem {
  role: "system" | "user" | "assistant";
  content: Conteudo;
}

async function configIA() {
  const db = supabaseAdmin();
  const [{ data: cfg }, { data: chave }] = await Promise.all([
    db.from("config").select("ia_base_url, ia_modelo").single(),
    db.rpc("ia_chave"),
  ]);
  if (!chave) throw new Error("Cadastre a chave da IA em Configurações.");
  return { base: String(cfg!.ia_base_url).replace(/\/?$/, "/"), modelo: cfg!.ia_modelo as string, chave: chave as string };
}

/** Chamada OpenAI-compatível (Gemini, Groq, OpenRouter, Ollama…). */
/** Modelo reserva quando o principal está sobrecarregado (só para o Gemini). */
const RESERVA: Record<string, string> = {
  "gemini-flash-latest": "gemini-flash-lite-latest",
  "gemini-pro-latest": "gemini-flash-latest",
};

async function completar(mensagens: Mensagem[], json: boolean) {
  const { base, modelo, chave } = await configIA();
  const tentativas = [modelo, modelo, RESERVA[modelo]].filter(Boolean) as string[];
  let ultimo = "";
  for (const [i, m] of tentativas.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000 * i)); // espera 2 s, 4 s
    const r = await fetch(`${base}chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: m,
        messages: mensagens,
        temperature: 0.3,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const corpo = await r.text();
    if (r.ok) {
      const j = JSON.parse(corpo);
      return { texto: String(j.choices?.[0]?.message?.content ?? ""), modelo: m };
    }
    ultimo = `${r.status}: ${corpo.slice(0, 200)}`;
    // 503 (sobrecarga) e 429 (limite por minuto) são passageiros: tenta de novo; o resto não
    if (r.status !== 503 && r.status !== 429) break;
  }
  if (/^503/.test(ultimo)) throw new Error("A IA está sobrecarregada agora (plano grátis). Tente de novo em 1 minuto.");
  if (/^429/.test(ultimo)) throw new Error("Limite gratuito da IA atingido. Tente de novo em alguns minutos.");
  if (/^404/.test(ultimo)) throw new Error("Modelo de IA indisponível: troque o modelo em Configurações (ex.: gemini-flash-latest).");
  throw new Error(`IA respondeu ${ultimo}`);
}

/** Ficha do lote em texto, usada como contexto da análise e da conversa. */
export function fichaLote(l: LotePainel, padroes: Parameters<typeof valoresLote>[1]) {
  const v = valoresLote(l, padroes);
  return [
    `Veículo: ${l.titulo}`,
    `Site: ${l.site_nome} | Link: ${l.url}`,
    `Ano: ${anosFmt(l.ano_fab, l.ano_mod) ?? "?"} | Km: ${kmFmt(l.km) ?? "não informado"} | Combustível: ${l.combustivel ?? "?"}`,
    `Local: ${[l.cidade, l.uf].filter(Boolean).join("-") || "?"} (o comprador fica em Passos-MG)`,
    `Classificação do sistema: ${MONTA[l.condicao_monta]?.rotulo} | ${RODA[l.roda]?.rotulo} | circulação: ${l.circulacao} | chave: ${l.chave} | procedência: ${PROCEDENCIA[l.procedencia]}`,
    l.dano_detalhe.length ? `Danos detectados no texto: ${l.dano_detalhe.join(", ")}` : null,
    `Lance atual: ${reais(l.lance_atual)} | Lance inicial: ${reais(l.lance_inicial)} | Encerra: ${quando(l.fim_em)}`,
    `Custo real estimado: ${reais(v.custo)} (comissão ${l.comissao_pct}%, taxas ${reais(v.taxaAdm)}, pátio ${reais(v.patio)}, documentação ${reais(v.doc)}, frete ${reais(v.frete)})`,
    `FIPE: ${reais(v.fipe)}${l.fipe_aproximada ? " (aproximada)" : ""} | Custo real / FIPE: ${v.pct != null ? Math.round(v.pct * 100) + "%" : "?"}`,
    l.financiavel != null ? `Financiável: ${l.financiavel ? "sim" : "não"}` : null,
    l.ipva_pago != null ? `IPVA pago: ${l.ipva_pago ? "sim" : "não"}` : null,
    `\nTexto original do site:\n${(l.observacoes ?? l.descricao ?? "(sem descrição)").slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const SISTEMA = `Você é um avaliador experiente de veículos de leilão no Brasil, ajudando um comprador pessoa física
que quer carros e motos para RODAR (não para peças). Seja direto, prático e honesto, em português do Brasil.
Conheça o mercado: monta (pequena/média/grande), vistoria CSV para média monta, sucata, circulação vedada,
leilão de financeira x seguradora, custos de pátio, documentação e frete. Use só os dados fornecidos e as fotos;
quando algo não estiver informado, diga que precisa ser conferido em vez de inventar.`;

async function fotosBase64(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls.slice(0, 3)) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 4_000_000) continue;
      out.push(`data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${buf.toString("base64")}`);
    } catch {
      /* foto indisponível */
    }
  }
  return out;
}

export async function gerarAnalise(l: LotePainel, padroes: Parameters<typeof valoresLote>[1]) {
  const fotos = await fotosBase64(l.fotos);
  const pedido = `${fichaLote(l, padroes)}

Analise este lote (dados acima${fotos.length ? " e fotos anexas" : ""}) e responda SOMENTE com um JSON:
{
  "veredito": "vale_a_pena" | "talvez" | "evitar",
  "resumo": "2 a 3 frases com a sua conclusão",
  "pontos_fortes": ["..."],
  "pontos_atencao": ["... (riscos, danos visíveis nas fotos, custos escondidos, documentação)"],
  "perguntas_vistoria": ["o que conferir na visitação/vistoria antes de dar lance"],
  "lance_maximo_sugerido": número em reais ou null (para o custo real ficar bem abaixo da FIPE, considerando reparos prováveis)
}`;
  const conteudo: Conteudo = [{ type: "text", text: pedido }, ...fotos.map((url) => ({ type: "image_url" as const, image_url: { url } }))];
  const { texto, modelo } = await completar(
    [
      { role: "system", content: SISTEMA },
      { role: "user", content: conteudo },
    ],
    true,
  );
  const limpo = texto.replace(/^```(?:json)?\s*|\s*```$/g, "");
  const a = JSON.parse(limpo) as AnaliseIA;
  return {
    modelo,
    analise: {
      veredito: ["vale_a_pena", "talvez", "evitar"].includes(a.veredito) ? a.veredito : "talvez",
      resumo: String(a.resumo ?? ""),
      pontos_fortes: (a.pontos_fortes ?? []).map(String).slice(0, 8),
      pontos_atencao: (a.pontos_atencao ?? []).map(String).slice(0, 10),
      perguntas_vistoria: (a.perguntas_vistoria ?? []).map(String).slice(0, 8),
      lance_maximo_sugerido: typeof a.lance_maximo_sugerido === "number" ? Math.round(a.lance_maximo_sugerido) : null,
    } satisfies AnaliseIA,
  };
}

export async function responderPergunta(
  l: LotePainel,
  padroes: Parameters<typeof valoresLote>[1],
  analise: AnaliseIA | null,
  historico: { papel: "user" | "assistant"; texto: string }[],
  pergunta: string,
) {
  const contexto = `${fichaLote(l, padroes)}${analise ? `\n\nSua análise anterior: ${JSON.stringify(analise)}` : ""}`;
  const { texto } = await completar(
    [
      { role: "system", content: `${SISTEMA}\n\nResponda perguntas sobre ESTE lote, em até 6 frases.\n\n${contexto}` },
      ...historico.slice(-10).map((m) => ({ role: m.papel, content: m.texto }) as Mensagem),
      { role: "user", content: pergunta },
    ],
    false,
  );
  return texto.trim();
}
