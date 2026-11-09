"use client";

import { useActionState, useState, useTransition } from "react";
import { removerCredencial, revelarSenha, salvarCredencial, salvarIA, testarIA, trocarSenha } from "./actions";

const campo =
  "press h-9 w-full rounded-md border border-line bg-bg px-2.5 text-sm outline-none hover:border-line-strong focus:border-amber/70";
const botao = "press h-9 rounded-md bg-amber px-4 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-60";
const botaoSec = "press h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-fg disabled:opacity-60";

type Res = { ok?: boolean | string; erro?: string } | null;
function Status({ r, pendente }: { r: Res; pendente?: boolean }) {
  if (pendente) return <span className="text-xs text-faint">salvando…</span>;
  if (r?.erro) return <span className="enter text-xs text-bad">{r.erro}</span>;
  if (r?.ok) return <span className="enter text-xs text-[#8fc9a1]">{typeof r.ok === "string" ? r.ok : "salvo"}</span>;
  return null;
}

const PROVEDORES = [
  { nome: "Google Gemini (grátis)", base: "https://generativelanguage.googleapis.com/v1beta/openai/", modelo: "gemini-2.5-flash", chave: "https://aistudio.google.com/apikey" },
  { nome: "Groq (grátis, open source)", base: "https://api.groq.com/openai/v1/", modelo: "llama-3.3-70b-versatile", chave: "https://console.groq.com/keys" },
  { nome: "OpenRouter", base: "https://openrouter.ai/api/v1/", modelo: "google/gemini-2.5-flash", chave: "https://openrouter.ai/keys" },
];

export function SecaoIA(p: { base: string; modelo: string; temChave: boolean }) {
  const [r, acao, pendente] = useActionState(salvarIA, null);
  const [base, setBase] = useState(p.base);
  const [modelo, setModelo] = useState(p.modelo);
  const [teste, setTeste] = useState<Res>(null);
  const [testando, startTeste] = useTransition();
  const atual = PROVEDORES.find((x) => x.base === base);

  return (
    <form action={acao} className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap gap-1">
        {PROVEDORES.map((x) => (
          <button
            type="button"
            key={x.nome}
            onClick={() => {
              setBase(x.base);
              setModelo(x.modelo);
            }}
            className={`press h-7 rounded-md border px-2 text-xs ${
              base === x.base ? "border-amber/50 bg-amber/12 text-amber" : "border-line text-muted hover:text-fg"
            }`}
          >
            {x.nome}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="space-y-1">
          <span className="text-[11px] text-faint">Endereço (compatível com OpenAI)</span>
          <input name="base" value={base} onChange={(e) => setBase(e.target.value)} className={`${campo} num text-xs`} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-faint">Modelo</span>
          <input name="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} className={`${campo} num text-xs`} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="flex justify-between text-[11px] text-faint">
          Chave da API {p.temChave ? "· cadastrada (deixe vazio para manter)" : "· não cadastrada"}
          {atual && (
            <a href={atual.chave} target="_blank" rel="noreferrer" className="text-amber hover:underline">
              gerar chave grátis ↗
            </a>
          )}
        </span>
        <input name="chave" type="password" autoComplete="off" placeholder={p.temChave ? "••••••••••••" : "cole a chave aqui"} className={campo} />
      </label>
      <p className="text-[11px] text-faint">A chave fica criptografada no Supabase Vault e só o servidor consegue lê-la.</p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Status r={teste ?? r} pendente={pendente || testando} />
        <button
          type="button"
          disabled={testando || !p.temChave}
          onClick={() => startTeste(async () => setTeste(await testarIA()))}
          className={botaoSec}
        >
          Testar
        </button>
        <button disabled={pendente} onClick={() => setTeste(null)} className={botao}>
          Salvar
        </button>
      </div>
    </form>
  );
}

interface Credencial {
  id: string;
  nome: string;
  site_slug: string | null;
  usuario: string | null;
  observacao: string | null;
  tem_senha: boolean;
}

export function Cofre({ itens, sites }: { itens: Credencial[]; sites: { slug: string; nome: string }[] }) {
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {itens.length === 0 && editando !== "novo" && (
          <li className="px-4 py-5 text-sm text-muted">Nenhum login guardado.</li>
        )}
        {itens.map((c) =>
          editando === c.id ? (
            <li key={c.id} className="p-3">
              <FormCredencial c={c} sites={sites} onFim={() => setEditando(null)} />
            </li>
          ) : (
            <LinhaCredencial key={c.id} c={c} onEditar={() => setEditando(c.id)} />
          ),
        )}
        {editando === "novo" && (
          <li className="p-3">
            <FormCredencial sites={sites} onFim={() => setEditando(null)} />
          </li>
        )}
      </ul>
      {editando !== "novo" && (
        <button onClick={() => setEditando("novo")} className={botaoSec}>
          + Adicionar login
        </button>
      )}
    </div>
  );
}

function LinhaCredencial({ c, onEditar }: { c: Credencial; onEditar: () => void }) {
  const [senha, setSenha] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const copiar = async (t: string, o: string) => {
    await navigator.clipboard.writeText(t);
    setCopiado(o);
    setTimeout(() => setCopiado(null), 1500);
  };
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{c.nome}</p>
        <p className="num truncate text-xs text-muted">
          {c.usuario || "—"}
          {c.usuario && (
            <button onClick={() => copiar(c.usuario!, "u")} className="ml-2 text-faint hover:text-fg">
              {copiado === "u" ? "copiado" : "copiar"}
            </button>
          )}
        </p>
        {c.observacao && <p className="text-[11px] text-faint">{c.observacao}</p>}
      </div>
      {c.tem_senha && (
        <div className="flex items-center gap-2">
          <span className="num min-w-24 text-sm">{senha ?? "••••••••"}</span>
          <button
            disabled={pendente}
            onClick={() =>
              senha ? setSenha(null) : start(async () => setSenha((await revelarSenha(c.id)) ?? "(vazio)"))
            }
            className="text-xs text-muted hover:text-fg"
          >
            {senha ? "ocultar" : "revelar"}
          </button>
          <button
            onClick={() => start(async () => copiar((senha ?? (await revelarSenha(c.id))) ?? "", "s"))}
            className="text-xs text-muted hover:text-fg"
          >
            {copiado === "s" ? "copiado" : "copiar"}
          </button>
        </div>
      )}
      <div className="flex gap-1">
        <button onClick={onEditar} className="press rounded px-2 py-1 text-xs text-muted hover:bg-raised hover:text-fg">
          Editar
        </button>
        <button
          onClick={() => confirm(`Remover o login de ${c.nome}?`) && start(() => removerCredencial(c.id))}
          className="press rounded px-2 py-1 text-xs text-muted hover:bg-bad/15 hover:text-[#e0938f]"
        >
          Remover
        </button>
      </div>
    </li>
  );
}

function FormCredencial({ c, sites, onFim }: { c?: Credencial; sites: { slug: string; nome: string }[]; onFim: () => void }) {
  const [r, acao, pendente] = useActionState(async (prev: Res, f: FormData) => {
    const res = await salvarCredencial(prev, f);
    if (res?.ok) onFim();
    return res;
  }, null);
  return (
    <form action={acao} className="grid gap-2 sm:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <select
        name="site"
        defaultValue={c?.site_slug ?? ""}
        className={campo}
        aria-label="Site"
        onChange={(e) => {
          const nome = e.currentTarget.form?.elements.namedItem("nome") as HTMLInputElement;
          const s = sites.find((x) => x.slug === e.target.value);
          if (s && nome && !nome.value) nome.value = s.nome;
        }}
      >
        <option value="">Outro (sem site)</option>
        {sites.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.nome}
          </option>
        ))}
      </select>
      <input name="nome" defaultValue={c?.nome} placeholder="Nome (ex.: VIP Leilões)" required className={campo} />
      <input name="usuario" defaultValue={c?.usuario ?? ""} placeholder="Login / e-mail / CPF" autoComplete="off" className={campo} />
      <input
        name="senha"
        type="password"
        autoComplete="new-password"
        placeholder={c?.tem_senha ? "Nova senha (vazio = manter)" : "Senha"}
        className={campo}
      />
      <input name="obs" defaultValue={c?.observacao ?? ""} placeholder="Observação (opcional)" className={`${campo} sm:col-span-2`} />
      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        <Status r={r} pendente={pendente} />
        <button type="button" onClick={onFim} className={botaoSec}>
          Cancelar
        </button>
        <button disabled={pendente} className={botao}>
          Salvar
        </button>
      </div>
    </form>
  );
}

export function SecaoSenha() {
  const [r, acao, pendente] = useActionState(trocarSenha, null);
  return (
    <form action={acao} className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-3">
      <input name="atual" type="password" autoComplete="current-password" placeholder="Senha atual" required className={campo} />
      <input name="nova" type="password" autoComplete="new-password" placeholder="Nova senha (mín. 8)" required className={campo} />
      <input name="confirma" type="password" autoComplete="new-password" placeholder="Confirmar nova senha" required className={campo} />
      <div className="flex items-center justify-end gap-3 sm:col-span-3">
        <Status r={r} pendente={pendente} />
        <button disabled={pendente} className={botao}>
          Alterar senha
        </button>
      </div>
    </form>
  );
}
