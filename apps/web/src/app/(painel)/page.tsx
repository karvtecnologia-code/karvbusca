import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export default async function LotesPage() {
  const supabase = await supabaseServer();
  const { count } = await supabase.from("lotes").select("*", { count: "exact", head: true });

  return (
    <section className="enter space-y-2">
      <h1 className="text-xl font-semibold tracking-tight">Lotes</h1>
      <p className="text-sm text-muted">
        <span className="num text-fg">{count ?? 0}</span> lotes no banco. Os robôs entram na fase 2.
        Enquanto isso, confira os seus{" "}
        <Link href="/termos" className="text-amber hover:underline">
          termos de busca
        </Link>
        .
      </p>
    </section>
  );
}
