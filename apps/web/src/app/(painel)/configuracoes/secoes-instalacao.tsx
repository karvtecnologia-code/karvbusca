"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { UFS_BR } from "@/lib/lotes";
import {
  conectarBot,
  criarUsuario,
  desligarChat,
  novoCodigoVinculo,
  removerUsuario,
  salvarEstados,
  salvarOrigem,
  salvarTokenBot,
} from "./acoes-instalacao";

const campo =
  "press h-9 w-full rounded-md border border-line bg-bg px-2.5 text-sm outline-none hover:border-line-strong focus:border-amber/70";
const botao = "press h-9 rounded-md bg-amber px-4 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-60";
const botaoSec = "press h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-fg disabled:opacity-60";

type Res = { ok?: boolean | string; erro?: string } | null;
function Status({ r, pendente }: { r: Res; pendente?: boolean }) {
  if (pendente) return <span className="text-xs text-faint">aguarde…</span>;
  if (r?.erro) return <span className="enter text-xs text-bad">{r.erro}</span>;
  if (r?.ok) return <span className="enter text-xs text-[#8fc9a1]">{typeof r.ok === "string" ? r.ok : "salvo"}</span>;
  return null;
}

// ---------------------------------------------------------------- Telegram

export function SecaoTelegram(p: {
  temToken: boolean;
  tokenNoEnv: boolean;
  codigo: string;
  chats: { chat_id: number; nome: string | null }[];
  usuarioBot: string | null;
}) {
  const [r, acao, pendente] = useActionState(salvarTokenBot, null);
  const [conexao, setConexao] = useState<Res>(null);
  const [conectando, startConexao] = useTransition();
  const [, start] = useTransition();
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <form action={acao} className="space-y-2">
        <label className="block space-y-1">
          <span className="flex justify-between text-[11px] text-faint">
            Token do bot{" "}
            {p.tokenNoEnv ? "· vindo da variável de ambiente" : p.temToken ? "· cadastrado (deixe vazio para manter)" : "· não cadastrado"}
            <button type="button" onClick={() => dialogo.current?.showModal()} className="text-amber hover:underline">
              Como criar o bot?
            </button>
          </span>
          <input name="token" type="password" autoComplete="off" placeholder="123456789:AAH…" className={`${campo} num`} />
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Status r={conexao ?? r} pendente={pendente || conectando} />
          <button
            type="button"
            disabled={conectando || (!p.temToken && !p.tokenNoEnv)}
            onClick={() => startConexao(async () => setConexao(await conectarBot()))}
            className={botaoSec}
          >
            Conectar bot
          </button>
          <button disabled={pendente} onClick={() => setConexao(null)} className={botao}>
            Salvar token
          </button>
        </div>
      </form>

      <div className="border-t border-line pt-3">
        <h3 className="mb-1 text-xs font-medium text-muted">Chats que recebem os alertas</h3>
        {p.chats.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum ainda. Depois de conectar, mande qualquer mensagem para o bot{p.usuarioBot ? ` @${p.usuarioBot}` : ""}: o primeiro chat é ligado
            sozinho.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {p.chats.map((c) => (
              <li key={c.chat_id} className="flex items-center justify-between py-1.5 text-sm">
                <span>
                  {c.nome || "sem nome"} <span className="num text-xs text-faint">#{c.chat_id}</span>
                </span>
                <button
                  onClick={() => confirm(`Desligar ${c.nome || c.chat_id}? Ele para de receber alertas.`) && start(() => desligarChat(c.chat_id))}
                  className="text-xs text-muted hover:text-[#e0938f]"
                >
                  Desligar
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">
          Para ligar outra pessoa: ela abre o bot{p.usuarioBot ? ` @${p.usuarioBot}` : ""} e manda{" "}
          <span className="num rounded bg-raised px-1.5 py-0.5 text-fg">/start {p.codigo}</span>{" "}
          <button onClick={() => start(() => novoCodigoVinculo())} className="text-faint underline-offset-2 hover:text-fg hover:underline">
            gerar outro código
          </button>
        </p>
      </div>

      <dialog
        ref={dialogo}
        onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
        className="m-auto w-[min(92vw,520px)] rounded-xl border border-line bg-surface p-0 text-fg backdrop:bg-black/70"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-semibold">Como criar o seu bot no Telegram</h3>
            <button onClick={() => dialogo.current?.close()} aria-label="Fechar" className="text-muted hover:text-fg">
              ✕
            </button>
          </div>
          <ol className="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed">
            <li>
              No Telegram, abra o{" "}
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-amber hover:underline">
                @BotFather
              </a>{" "}
              (o oficial tem o selo azul) e toque em <b>Iniciar</b>.
            </li>
            <li>
              Mande <span className="num rounded bg-raised px-1.5">/newbot</span>.
            </li>
            <li>Escolha um nome, por exemplo <i>Meu KarvBusca</i>.</li>
            <li>
              Escolha um usuário que termine em <span className="num">bot</span>, por exemplo{" "}
              <span className="num">meukarvbusca_bot</span>.
            </li>
            <li>
              O BotFather responde com o <b>token</b>, uma linha parecida com{" "}
              <span className="num break-all text-muted">123456789:AAHk…</span>. Copie e cole no campo “Token do bot”.
            </li>
            <li>
              Clique em <b>Salvar token</b> e depois em <b>Conectar bot</b>.
            </li>
            <li>
              Abra o seu bot e mande qualquer mensagem. Deve chegar <i>“✅ KarvBusca conectado”</i>.
            </li>
          </ol>
          <p className="rounded-md bg-raised px-3 py-2 text-xs text-muted">
            O token é como uma senha do bot: não envie para ninguém. Aqui ele fica criptografado no Supabase Vault.
          </p>
          <div className="flex justify-end">
            <button onClick={() => dialogo.current?.close()} className={botao}>
              Entendi
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

// ---------------------------------------------------------------- estados e origem

export function SecaoEstados({ ufs }: { ufs: string[] }) {
  const [r, acao, pendente] = useActionState(salvarEstados, null);
  return (
    <form action={acao} className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
        {UFS_BR.map((u) => (
          <label
            key={u}
            className="press flex h-8 cursor-pointer items-center justify-center rounded-md border border-line text-xs text-muted has-[:checked]:border-amber/50 has-[:checked]:bg-amber/12 has-[:checked]:text-amber"
          >
            <input type="checkbox" name="uf" value={u} defaultChecked={ufs.includes(u)} className="sr-only" />
            {u}
          </label>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        <Status r={r} pendente={pendente} />
        <button disabled={pendente} className={botao}>
          Salvar estados
        </button>
      </div>
    </form>
  );
}

export function SecaoOrigem({ origem }: { origem: string }) {
  const [r, acao, pendente] = useActionState(salvarOrigem, null);
  const [cidade, uf] = origem.includes("-") ? [origem.slice(0, origem.lastIndexOf("-")), origem.slice(-2)] : [origem, ""];
  return (
    <form action={acao} className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[1fr_100px_auto] sm:items-end">
      <label className="space-y-1">
        <span className="text-[11px] text-faint">Cidade</span>
        <input name="cidade" defaultValue={cidade} placeholder="Passos" className={campo} />
      </label>
      <label className="space-y-1">
        <span className="text-[11px] text-faint">UF</span>
        <select name="uf" defaultValue={uf} className={campo}>
          {UFS_BR.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </label>
      <button disabled={pendente} className={botao}>
        Salvar
      </button>
      <div className="sm:col-span-3">
        <Status r={r} pendente={pendente} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- usuários

export function SecaoUsuarios({ usuarios, eu }: { usuarios: { id: string; email: string; ultimo: string | null }[]; eu: string }) {
  const [r, acao, pendente] = useActionState(criarUsuario, null);
  const [rem, setRem] = useState<Res>(null);
  const [, start] = useTransition();
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {usuarios.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm">
                {u.email} {u.id === eu && <span className="text-xs text-faint">(você)</span>}
              </p>
              <p className="text-[11px] text-faint">
                {u.ultimo ? `último acesso ${new Date(u.ultimo).toLocaleString("pt-BR")}` : "nunca entrou"}
              </p>
            </div>
            {u.id !== eu && (
              <button
                onClick={() => confirm(`Remover o acesso de ${u.email}?`) && start(async () => setRem(await removerUsuario(u.id)))}
                className="text-xs text-muted hover:text-[#e0938f]"
              >
                Remover
              </button>
            )}
          </li>
        ))}
      </ul>
      <form action={acao} className="grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]">
        <input name="email" type="email" placeholder="E-mail do novo usuário" required autoComplete="off" className={campo} />
        <input name="senha" type="password" placeholder="Senha inicial (mín. 8)" required autoComplete="new-password" className={campo} />
        <button disabled={pendente} className={botao}>
          Criar acesso
        </button>
        <div className="sm:col-span-3">
          <Status r={rem ?? r} pendente={pendente} />
        </div>
      </form>
      <p className="text-[11px] text-faint">
        Todos os usuários veem os mesmos lotes, favoritos e descartes. A pessoa pode trocar a senha em Configurações → Senha.
      </p>
    </div>
  );
}
