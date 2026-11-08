import { sair } from "../login/actions";
import { Nav } from "./nav";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">KarvBusca</span>
          </div>
          <Nav />
          <form action={sair} className="ml-auto">
            <button className="press text-xs text-muted hover:text-fg">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
