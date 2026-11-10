/** Análise de lote por IA (API compatível com OpenAI: Gemini, Groq, OpenRouter…). Usado pelo painel e pelo robô. */

export interface AnaliseIA {
  veredito: "vale_a_pena" | "talvez" | "evitar";
  resumo: string;
  pontos_fortes: string[];
  pontos_atencao: string[];
  perguntas_vistoria: string[];
  lance_maximo_sugerido: number | null;
}

export interface ConfigIA {
  base: string;
  modelo: string;
  chave: string;
}

type Conteudo = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
export interface MensagemIA {
  role: "system" | "user" | "assistant";
  content: Conteudo;
}

export class ErroIA extends Error {
  constructor(
    msg: string,
    public status: number,
  ) {
    super(msg);
  }
}

export const SISTEMA_IA = `Você é um avaliador experiente de veículos de leilão no Brasil, ajudando um comprador pessoa física
que quer carros e motos para RODAR (não para peças). Seja direto, prático e honesto, em português do Brasil.
Conheça o mercado: monta (pequena/média/grande), vistoria CSV para média monta, sucata, circulação vedada,
leilão de financeira x seguradora, custos de pátio, documentação e frete. Use só os dados fornecidos e as fotos;
quando algo não estiver informado, diga que precisa ser conferido em vez de inventar.`;

/** Modelo reserva quando o principal está sobrecarregado. */
const RESERVA: Record<string, string> = {
  "gemini-flash-latest": "gemini-flash-lite-latest",
  "gemini-pro-latest": "gemini-flash-latest",
};

export async function completarIA(cfg: ConfigIA, mensagens: MensagemIA[], json: boolean) {
  const base = cfg.base.replace(/\/?$/, "/");
  const tentativas = [cfg.modelo, cfg.modelo, RESERVA[cfg.modelo]].filter(Boolean) as string[];
  let status = 0;
  let corpo = "";
  for (const [i, m] of tentativas.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000 * i));
    const r = await fetch(`${base}chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.chave}` },
      body: JSON.stringify({
        model: m,
        messages: mensagens,
        temperature: 0.3,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    corpo = await r.text();
    status = r.status;
    if (r.ok) {
      const j = JSON.parse(corpo);
      return { texto: String(j.choices?.[0]?.message?.content ?? ""), modelo: m };
    }
    // 503 (sobrecarga) e 429 (limite por minuto) são passageiros: tenta de novo
    if (status !== 503 && status !== 429) break;
  }
  if (status === 503) throw new ErroIA("A IA está sobrecarregada agora (plano grátis). Tente de novo em 1 minuto.", 503);
  if (status === 429) throw new ErroIA("Limite gratuito da IA atingido. Tente de novo mais tarde.", 429);
  if (status === 404) throw new ErroIA("Modelo de IA indisponível: troque o modelo em Configurações.", 404);
  throw new ErroIA(`IA respondeu ${status}: ${corpo.slice(0, 200)}`, status);
}

/** Baixa até 3 fotos e devolve como data URL (o Gemini não busca URLs sozinho). */
export async function fotosParaIA(urls: string[], max = 3): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls.slice(0, max)) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) continue;
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length > 4_000_000) continue;
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      out.push(`data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${btoa(bin)}`);
    } catch {
      /* foto indisponível */
    }
  }
  return out;
}

/** Gera a análise estruturada de um lote a partir da ficha em texto e das fotos. */
export async function analisarLoteIA(cfg: ConfigIA, ficha: string, fotos: string[]) {
  const pedido = `${ficha}

Analise este lote (dados acima${fotos.length ? " e fotos anexas" : ""}) e responda SOMENTE com um JSON:
{
  "veredito": "vale_a_pena" | "talvez" | "evitar",
  "resumo": "2 a 3 frases com a sua conclusão",
  "pontos_fortes": ["..."],
  "pontos_atencao": ["... (riscos, danos visíveis nas fotos, custos escondidos, documentação)"],
  "perguntas_vistoria": ["o que conferir na visitação/vistoria antes de dar lance"],
  "lance_maximo_sugerido": número em reais ou null (para o custo real ficar bem abaixo da FIPE, considerando reparos prováveis)
}`;
  const conteudo: Conteudo = [
    { type: "text", text: pedido },
    ...fotos.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
  const { texto, modelo } = await completarIA(
    cfg,
    [
      { role: "system", content: SISTEMA_IA },
      { role: "user", content: conteudo },
    ],
    true,
  );
  const a = JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Partial<AnaliseIA>;
  const analise: AnaliseIA = {
    veredito: a.veredito && ["vale_a_pena", "talvez", "evitar"].includes(a.veredito) ? a.veredito : "talvez",
    resumo: String(a.resumo ?? ""),
    pontos_fortes: (a.pontos_fortes ?? []).map(String).slice(0, 8),
    pontos_atencao: (a.pontos_atencao ?? []).map(String).slice(0, 10),
    perguntas_vistoria: (a.perguntas_vistoria ?? []).map(String).slice(0, 8),
    lance_maximo_sugerido: typeof a.lance_maximo_sugerido === "number" ? Math.round(a.lance_maximo_sugerido) : null,
  };
  return { analise, modelo };
}

export const ROTULO_VEREDITO: Record<AnaliseIA["veredito"], string> = {
  vale_a_pena: "✅ Vale a pena olhar",
  talvez: "🤔 Talvez",
  evitar: "⛔ Evitar",
};
