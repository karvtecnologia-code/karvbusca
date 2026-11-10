import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { FormPadroes, FormSite } from "./forms";
import { Cofre, SecaoIA, SecaoOportunidades, SecaoSenha } from "./secoes";
import { SecaoEstados, SecaoOrigem, SecaoTelegram, SecaoUsuarios } from "./secoes-instalacao";
import { listarUsuarios } from "./acoes-instalacao";
import { tokenBot } from "@/lib/telegram";

const NAV = [
  ["telegram", "Telegram"],
  ["regiao", "Estados e origem"],
  ["custos", "Custos"],
  ["oportunidades", "Oportunidades"],
  ["sites", "Sites"],
  ["ia", "IA"],
  ["cofre", "Logins"],
  ["usuarios", "Usuários"],
  ["senha", "Senha"],
] as const;

export default async function ConfiguracoesPage() {
  const supabase = await supabaseServer();
  const [{ data: cfg }, { data: sites }, { data: creds }, { data: { user } }, { data: chats }, usuarios, token] =
    await Promise.all([
      supabase
        .from("config")
        .select(
          "custo_doc_padrao, custo_patio_padrao, frete_padrao, frete_por_km, ia_base_url, ia_modelo, ia_secret_id, descoberta_ativa, descoberta_pct_fipe, descoberta_ano_min, nota_alerta_quente, ia_auto_max_dia, ufs, origem, codigo_vinculo, telegram_secret_id",
        )
        .single(),
      supabase.from("sites").select("id, slug, nome, comissao_pct, taxa_adm, ativo").order("id"),
      supabase.from("credenciais").select("id, nome, site_slug, usuario, observacao, secret_id").order("nome"),
      supabase.auth.getUser(),
      supabase.from("telegram_chats").select("chat_id, nome").order("vinculado_em"),
      listarUsuarios(),
      tokenBot(),
    ]);
  // nome do bot para as instruções (só se já houver token)
  const usuarioBot = token
    ? await fetch(`https://api.telegram.org/bot${token}/getMe`, { next: { revalidate: 3600 } })
        .then((r) => r.json())
        .then((j) => (j.ok ? (j.result.username as string) : null))
        .catch(() => null)
    : null;

  const Titulo = ({ id, children, sub }: { id: string; children: React.ReactNode; sub?: string }) => (
    <div id={id} className="scroll-mt-20 space-y-0.5">
      <h2 className="text-sm font-medium">{children}</h2>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[160px_1fr]">
      <nav className="hidden lg:block">
        <ul className="sticky top-20 space-y-0.5">
          {NAV.map(([id, nome]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-md px-2 py-1 text-sm text-muted hover:bg-raised hover:text-fg">
                {nome}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section className="max-w-2xl space-y-10">
        <header className="enter space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted">Telegram, região, custos, sites, IA, logins guardados, usuários e senha.</p>
        </header>

        <div className="space-y-3">
          <Titulo id="telegram" sub="Os alertas chegam por um bot seu. Os botões 👍/🗑 do Telegram valem no site.">
            Telegram
          </Titulo>
          <SecaoTelegram
            temToken={!!cfg?.telegram_secret_id}
            tokenNoEnv={!!process.env.TELEGRAM_BOT_TOKEN}
            codigo={cfg?.codigo_vinculo ?? ""}
            chats={(chats ?? []).map((c) => ({ chat_id: Number(c.chat_id), nome: c.nome }))}
            usuarioBot={usuarioBot}
          />
        </div>

        <div className="space-y-3">
          <Titulo id="regiao" sub="O robô coleta todos os estados. Os marcados aqui são os preferidos: recebem alerta no Telegram, entram no modo descoberta e aparecem por padrão na aba Lotes. A cidade é usada na distância e no frete.">
            Estados e origem
          </Titulo>
          <SecaoEstados ufs={cfg?.ufs ?? ["SP", "MG"]} />
          <SecaoOrigem origem={cfg?.origem ?? "Passos-MG"} />
        </div>

        <div className="space-y-3">
          <Titulo id="custos" sub="Usados no custo real. Cada lote pode sobrescrever na própria página.">
            Custos padrão
          </Titulo>
          <FormPadroes doc={cfg?.custo_doc_padrao ?? 0} patio={cfg?.custo_patio_padrao ?? 0} frete={cfg?.frete_padrao ?? null} />
        </div>

        <div className="space-y-3">
          <Titulo id="oportunidades" sub="Descoberta, nota de oportunidade, IA automática e frete por km.">
            Oportunidades
          </Titulo>
          <SecaoOportunidades
            descoberta={cfg?.descoberta_ativa ?? true}
            pct={Number(cfg?.descoberta_pct_fipe ?? 0.65)}
            ano={cfg?.descoberta_ano_min ?? 2012}
            quente={cfg?.nota_alerta_quente ?? 75}
            ia={cfg?.ia_auto_max_dia ?? 5}
            porKm={cfg?.frete_por_km ?? null}
          />
        </div>

        <div className="space-y-3">
          <Titulo id="sites" sub="Desmarque para o robô parar de buscar naquele site.">
            Sites
          </Titulo>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {(sites ?? []).map((s) => (
              <li key={s.id} className="p-3">
                <FormSite site={s} />
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <Titulo id="ia" sub="Analisa cada lote quando você clica em “Analisar com IA” na página dele.">
            Inteligência artificial
          </Titulo>
          <SecaoIA base={cfg?.ia_base_url ?? ""} modelo={cfg?.ia_modelo ?? ""} temChave={!!cfg?.ia_secret_id} />
        </div>

        <div className="space-y-3">
          <Titulo id="cofre" sub="Senhas criptografadas no Supabase Vault. Só para consulta: o robô não faz login nos sites.">
            Logins dos sites
          </Titulo>
          <Cofre
            itens={(creds ?? []).map((c) => ({ ...c, tem_senha: !!c.secret_id }))}
            sites={(sites ?? []).map((s) => ({ slug: s.slug, nome: s.nome }))}
          />
        </div>

        <div className="space-y-3">
          <Titulo id="usuarios" sub="Quem pode entrar no painel. O cadastro público fica desligado: só quem já tem acesso cria outros.">
            Usuários
          </Titulo>
          <SecaoUsuarios usuarios={usuarios} eu={user?.id ?? ""} />
        </div>

        <div className="space-y-3">
          <Titulo id="senha" sub={`Entrar no painel como ${user?.email ?? ""}.`}>
            Senha do sistema
          </Titulo>
          <SecaoSenha />
        </div>

        <Link href="/descartados" className="inline-block text-xs text-faint hover:text-fg">
          Ver lotes descartados →
        </Link>
      </section>
    </div>
  );
}
