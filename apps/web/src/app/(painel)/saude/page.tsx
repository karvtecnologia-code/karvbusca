import { supabaseServer } from "@/lib/supabase/server";
import { BotaoRodar } from "./botao-rodar";

interface Site {
  id: number;
  slug: string;
  nome: string;
  url: string;
  ativo: boolean;
  status: string;
  ultima_execucao: string | null;
  falhas_seguidas: number;
}
interface Execucao {
  id: number;
  site_id: number;
  modo: string;
  inicio: string;
  fim: string | null;
  encontrados: number;
  novos: number;
  atualizados: number;
  erro: string | null;
}

const quando = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const ESTADOS: Record<string, { rotulo: string; cor: string }> = {
  ok: { rotulo: "OK", cor: "bg-ok" },
  erro: { rotulo: "Erro", cor: "bg-bad" },
  vazio: { rotulo: "0 lotes", cor: "bg-amber" },
  nunca_rodou: { rotulo: "Nunca rodou", cor: "bg-faint" },
};

function duracao(a: string, b: string | null) {
  if (!b) return "—";
  const s = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
}

export default async function SaudePage() {
  const supabase = await supabaseServer();
  const [{ data: sites }, { data: execs }] = await Promise.all([
    supabase.from("sites").select("id, slug, nome, url, ativo, status, ultima_execucao, falhas_seguidas").order("id"),
    supabase
      .from("execucoes_robo")
      .select("id, site_id, modo, inicio, fim, encontrados, novos, atualizados, erro")
      .order("inicio", { ascending: false })
      .limit(60),
  ]);
  const lista = (sites ?? []) as Site[];
  const porSite = new Map<number, Execucao[]>();
  for (const e of (execs ?? []) as Execucao[]) {
    if (!porSite.has(e.site_id)) porSite.set(e.site_id, []);
    porSite.get(e.site_id)!.push(e);
  }

  return (
    <section className="space-y-6">
      <header className="enter flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Saúde dos robôs</h1>
          <p className="text-sm text-muted">
            Busca completa às 07:00, 12:00 e 18:00. Favoritos a cada 2h, das 07:00 às 23:00.
          </p>
        </div>
        <BotaoRodar />
      </header>

      <ul className="grid gap-3 md:grid-cols-2">
        {lista.map((s, i) => {
          const ex = porSite.get(s.id) ?? [];
          const ultima = ex.find((e) => e.modo === "completo") ?? ex[0];
          const est = ESTADOS[s.status] ?? ESTADOS.nunca_rodou!;
          return (
            <li
              key={s.id}
              className="enter rounded-lg border border-line bg-surface p-4"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${est.cor}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <a href={s.url} target="_blank" rel="noreferrer" className="font-medium hover:text-amber">
                      {s.nome}
                    </a>
                    <span className="text-xs text-muted">{est.rotulo}</span>
                  </div>
                  <p className="num mt-0.5 text-xs text-faint">
                    {s.ultima_execucao ? `última: ${quando.format(new Date(s.ultima_execucao))}` : "sem execuções"}
                    {s.falhas_seguidas > 0 && <span className="text-bad"> · {s.falhas_seguidas} falha(s) seguida(s)</span>}
                  </p>
                </div>
                <BotaoRodar site={s.slug} compacto />
              </div>

              {ultima && (
                <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-3">
                  {[
                    ["Encontrados", ultima.encontrados],
                    ["Novos", ultima.novos],
                    ["Atualizados", ultima.atualizados],
                    ["Duração", duracao(ultima.inicio, ultima.fim)],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <dt className="text-[11px] text-faint">{k}</dt>
                      <dd className="num text-sm">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {ultima?.erro && (
                <p className="mt-3 rounded-md bg-bad/10 px-2.5 py-2 text-xs break-words text-bad">{ultima.erro}</p>
              )}

              {ex.length > 1 && (
                <details className="group mt-3">
                  <summary className="cursor-pointer text-xs text-muted select-none hover:text-fg">
                    Últimas execuções
                  </summary>
                  <table className="num mt-2 w-full text-xs">
                    <tbody>
                      {ex.slice(0, 8).map((e) => (
                        <tr key={e.id} className="border-t border-line/60">
                          <td className="py-1 text-muted">{quando.format(new Date(e.inicio))}</td>
                          <td className="py-1 text-faint">{e.modo}</td>
                          <td className="py-1 text-right">{e.encontrados}</td>
                          <td className="py-1 text-right text-ok">+{e.novos}</td>
                          <td className="py-1 pl-2 text-right">{e.erro ? <span className="text-bad">erro</span> : "ok"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
