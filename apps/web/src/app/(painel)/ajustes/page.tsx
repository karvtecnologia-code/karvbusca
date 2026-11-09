import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { FormPadroes, FormSite } from "./forms";

export default async function AjustesPage() {
  const supabase = await supabaseServer();
  const [{ data: cfg }, { data: sites }] = await Promise.all([
    supabase.from("config").select("custo_doc_padrao, custo_patio_padrao, frete_padrao, chat_id_telegram").single(),
    supabase.from("sites").select("id, nome, comissao_pct, taxa_adm, ativo").order("id"),
  ]);

  return (
    <section className="max-w-2xl space-y-8">
      <header className="enter space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted">Valores usados no custo real. Cada lote pode sobrescrever na própria página.</p>
      </header>

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Custos padrão</h2>
        <FormPadroes
          doc={cfg?.custo_doc_padrao ?? 0}
          patio={cfg?.custo_patio_padrao ?? 0}
          frete={cfg?.frete_padrao ?? null}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Sites</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {(sites ?? []).map((s) => (
            <li key={s.id} className="p-3">
              <FormSite site={s} />
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1 text-sm">
        <h2 className="font-medium">Telegram</h2>
        <p className="text-muted">
          {cfg?.chat_id_telegram ? "Conectado ao seu chat." : "Ainda não conectado: mande uma mensagem para o bot."}
        </p>
      </div>

      <Link href="/descartados" className="inline-block text-xs text-faint hover:text-fg">
        Ver lotes descartados →
      </Link>
    </section>
  );
}
