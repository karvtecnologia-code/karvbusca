"use client";

import { useMemo, useState, useTransition } from "react";
import { calcularLote, type PadroesCusto } from "@karv/core";
import { salvarCustos } from "../../lotes-actions";
import { reais, type LotePainel } from "@/lib/lotes";

const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", ".")));

export function Calculadora({ lote: l, padroes }: { lote: LotePainel; padroes: PadroesCusto }) {
  const [lance, setLance] = useState(String(l.lance_atual ?? ""));
  const [patio, setPatio] = useState(l.custo_patio != null ? String(l.custo_patio) : "");
  const [doc, setDoc] = useState(l.custo_doc != null ? String(l.custo_doc) : "");
  const [frete, setFrete] = useState(l.custo_frete != null ? String(l.custo_frete) : "");
  const [pendente, start] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const v = useMemo(
    () =>
      calcularLote(
        { ...l, lance_atual: n(lance), custo_patio: n(patio), custo_doc: n(doc), custo_frete: n(frete) },
        padroes,
      ),
    [l, lance, patio, doc, frete, padroes],
  );
  // lance máximo para ficar em 70% da FIPE (resolve a fórmula do custo para o lance)
  const lanceAlvo = v.fipe
    ? Math.max(0, Math.floor((0.7 * v.fipe - (v.custo - v.lance * (1 + Number(l.comissao_pct) / 100))) / (1 + Number(l.comissao_pct) / 100)))
    : null;

  const linhas: [string, number][] = [
    ["Lance", v.lance],
    [`Comissão (${Number(l.comissao_pct)}%)`, v.comissao],
    [l.taxas_site != null ? "Taxas do site (adm, estadia…)" : "Taxa adm.", v.taxaAdm],
    ["Pátio", v.patio],
    ["Frete", v.frete],
    ["Documentação", v.doc],
  ];
  const campo =
    "press num h-8 w-full rounded-md border border-line bg-bg px-2 text-right text-sm outline-none focus:border-amber/70";

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium">Custo real</h2>

      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Simular lance" valor={lance} set={setLance} classe={campo} />
        <Campo rotulo="Frete (R$)" valor={frete} set={(x) => { setFrete(x); setSalvo(false); }} classe={campo} dica={padroes.frete_padrao ? `padrão ${padroes.frete_padrao}` : "padrão 0"} />
        <Campo rotulo="Pátio (R$)" valor={patio} set={(x) => { setPatio(x); setSalvo(false); }} classe={campo} dica={l.taxas_site != null ? "já nas taxas" : `padrão ${padroes.custo_patio_padrao}`} />
        <Campo rotulo="Documentação (R$)" valor={doc} set={(x) => { setDoc(x); setSalvo(false); }} classe={campo} dica={`padrão ${padroes.custo_doc_padrao}`} />
      </div>

      <dl className="num mt-4 space-y-1 border-t border-line pt-3 text-sm">
        {linhas.map(([k, x]) => (
          <div key={k} className="flex justify-between gap-4 text-muted">
            <dt>{k}</dt>
            <dd>{reais(x)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-medium">
          <dt>Custo real</dt>
          <dd>{reais(v.custo)}</dd>
        </div>
        {v.fipe != null && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">vs. FIPE {reais(v.fipe)}</dt>
            <dd className={v.pct != null && v.pct < 0.7 ? "text-[#8fc9a1]" : ""}>
              {v.pct != null ? `${Math.round(v.pct * 100)}%` : "—"}
            </dd>
          </div>
        )}
        {lanceAlvo != null && (
          <p className="pt-1 text-xs text-faint">
            Lance máximo para ficar em 70% da FIPE: <span className="text-fg">{reais(lanceAlvo)}</span>
          </p>
        )}
      </dl>

      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-[11px] text-faint">{salvo ? "custos salvos" : "o lance simulado não é salvo"}</span>
        <button
          disabled={pendente}
          onClick={() => {
            const f = new FormData();
            f.set("patio", patio);
            f.set("doc", doc);
            f.set("frete", frete);
            start(async () => {
              await salvarCustos(l.id, f);
              setSalvo(true);
            });
          }}
          className="press h-8 rounded-md border border-line px-3 text-xs text-muted hover:text-fg disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar custos do lote"}
        </button>
      </div>
    </section>
  );
}

function Campo(p: { rotulo: string; valor: string; set: (v: string) => void; classe: string; dica?: string }) {
  return (
    <label className="block space-y-1">
      <span className="flex justify-between text-[11px] text-faint">
        {p.rotulo}
        {p.dica && <span className="text-faint/70">{p.dica}</span>}
      </span>
      <input inputMode="decimal" value={p.valor} onChange={(e) => p.set(e.target.value)} className={p.classe} />
    </label>
  );
}
