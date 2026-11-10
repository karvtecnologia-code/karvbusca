"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AnaliseIA } from "@/lib/ia";
import { analisarLote, limparConversa, perguntarIA } from "./ia-actions";

const VEREDITO = {
  vale_a_pena: { rotulo: "Vale a pena olhar", cor: "border-ok/40 bg-ok/10 text-[#8fc9a1]" },
  talvez: { rotulo: "Talvez", cor: "border-amber/40 bg-amber/10 text-[#f3c36f]" },
  evitar: { rotulo: "Evitar", cor: "border-bad/40 bg-bad/12 text-[#e0938f]" },
} as const;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const SUGESTOES = ["Quanto devo gastar de reparo?", "Compensa buscar até a minha cidade?", "Esse carro passa na vistoria?"];

interface Msg {
  papel: "user" | "assistant";
  texto: string;
}

export function LoteIA(p: {
  loteId: string;
  analise: AnaliseIA | null;
  geradoEm: string | null;
  modelo: string | null;
  mensagens: Msg[];
  configurada: boolean;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [analisando, startAnalise] = useTransition();
  const [msgs, setMsgs] = useState<Msg[]>(p.mensagens);
  const [pergunta, setPergunta] = useState("");
  const [respondendo, startPergunta] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgs.length) fimRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [msgs.length]);

  const analisar = () =>
    startAnalise(async () => {
      setErro(null);
      const r = await analisarLote(p.loteId);
      if (r.erro) setErro(r.erro);
    });

  const enviar = (texto: string) => {
    const t = texto.trim();
    if (!t || respondendo) return;
    setPergunta("");
    setErro(null);
    setMsgs((m) => [...m, { papel: "user", texto: t }]);
    startPergunta(async () => {
      const r = await perguntarIA(p.loteId, t);
      if (r.erro) {
        setErro(r.erro);
        setMsgs((m) => m.slice(0, -1));
        setPergunta(t);
      } else setMsgs((m) => [...m, { papel: "assistant", texto: r.resposta! }]);
    });
  };

  if (!p.configurada)
    return (
      <section className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
        <h2 className="mb-1 font-medium text-fg">Análise com IA</h2>
        Cadastre a chave do Gemini em{" "}
        <Link href="/configuracoes#ia" className="text-amber hover:underline">
          Configurações
        </Link>{" "}
        para analisar este lote.
      </section>
    );

  const a = p.analise;
  const v = a ? VEREDITO[a.veredito] : null;

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Análise com IA</h2>
        {a && (
          <button
            onClick={analisar}
            disabled={analisando}
            className="press text-xs text-muted hover:text-fg disabled:opacity-60"
          >
            {analisando ? "Analisando…" : "Refazer"}
          </button>
        )}
      </div>

      {!a && (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            A IA lê os dados, o texto original do site e as fotos, e resume os pontos fortes, o que exige atenção e o
            que conferir na vistoria.
          </p>
          <button
            onClick={analisar}
            disabled={analisando}
            className="press h-9 rounded-md bg-amber px-4 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-70"
          >
            {analisando ? "Analisando (até 30 s)…" : "✦ Analisar com IA"}
          </button>
        </div>
      )}

      {a && v && (
        <div className={`space-y-4 transition-opacity duration-200 ${analisando ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex h-6 items-center rounded border px-2 text-xs font-medium ${v.cor}`}>{v.rotulo}</span>
            {a.lance_maximo_sugerido != null && (
              <span className="num text-xs text-muted">
                lance máx. sugerido <span className="text-fg">{brl.format(a.lance_maximo_sugerido)}</span>
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{a.resumo}</p>
          <Lista titulo="Pontos fortes" itens={a.pontos_fortes} marca="+" cor="text-[#8fc9a1]" />
          <Lista titulo="Pontos de atenção" itens={a.pontos_atencao} marca="!" cor="text-[#f3c36f]" />
          <Lista titulo="Conferir na vistoria" itens={a.perguntas_vistoria} marca="?" cor="text-muted" />
          <p className="text-[11px] text-faint">
            {p.modelo} · {p.geradoEm ? new Date(p.geradoEm).toLocaleString("pt-BR") : ""} · a IA pode errar: confira
            no edital e na visitação.
          </p>
        </div>
      )}

      {/* conversa aberta sobre o lote */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium text-muted">Pergunte sobre este lote</h3>
          {msgs.length > 0 && (
            <button
              onClick={() => {
                setMsgs([]);
                void limparConversa(p.loteId);
              }}
              className="text-[11px] text-faint hover:text-fg"
            >
              Limpar conversa
            </button>
          )}
        </div>
        {msgs.length > 0 && (
          <div className="mb-3 max-h-96 space-y-2 overflow-y-auto pr-1">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`enter max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${
                  m.papel === "user" ? "ml-auto bg-raised" : "border border-line bg-bg text-fg/90"
                }`}
              >
                {m.texto}
              </div>
            ))}
            {respondendo && <div className="w-16 animate-pulse rounded-lg border border-line bg-bg px-3 py-2 text-sm text-faint">…</div>}
            <div ref={fimRef} />
          </div>
        )}
        {msgs.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="press rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-line-strong hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(pergunta);
          }}
          className="flex gap-2"
        >
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Ex.: o que significa 'motor parcial'?"
            className="press h-9 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none focus:border-amber/70"
          />
          <button
            disabled={respondendo || !pergunta.trim()}
            className="press h-9 shrink-0 rounded-md border border-line px-3 text-sm text-muted hover:text-fg disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>
      {erro && <p className="enter mt-3 text-xs text-bad">{erro}</p>}
    </section>
  );
}

function Lista({ titulo, itens, marca, cor }: { titulo: string; itens: string[]; marca: string; cor: string }) {
  if (!itens.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium text-muted">{titulo}</h3>
      <ul className="space-y-1">
        {itens.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug">
            <span className={`num w-3 shrink-0 ${cor}`}>{marca}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
