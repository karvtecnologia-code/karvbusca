import { supabaseServer } from "@/lib/supabase/server";
import { TermosLista, type TermoRow } from "./termos-lista";

export default async function TermosPage() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("termos_busca")
    .select("id, termo, apelidos, tipo, ano_min, ano_max, lance_max, ativo")
    .order("termo");

  return (
    <section className="space-y-6">
      <header className="enter space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Termos de busca</h1>
        <p className="text-sm text-muted">
          Modelos que o robô procura nos 5 sites. A comparação ignora acento, hífen e espaço:
          <span className="num text-fg"> hr-v</span>, <span className="num text-fg">hr v</span> e{" "}
          <span className="num text-fg">hrv</span> são iguais.
        </p>
      </header>
      {error ? (
        <p className="text-sm text-bad">Erro ao carregar: {error.message}</p>
      ) : (
        <TermosLista termos={(data ?? []) as TermoRow[]} />
      )}
    </section>
  );
}
