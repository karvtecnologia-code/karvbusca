import { sair } from "../login/actions";
import { Nav, NavAbas } from "./nav";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-4 sm:h-14">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">KarvBusca</span>
          </div>
          {/* PC e tablet: abas no topo; celular: barra de abas embaixo (ao alcance do polegar) */}
          <div className="hidden sm:block">
            <Nav />
          </div>
          <form action={sair} className="ml-auto">
            <button className="press -mr-2 h-10 px-2 text-xs text-muted hover:text-fg">Sair</button>
          </form>
        </div>
      </header>
      <main className="pb-abas mx-auto max-w-6xl px-4 pt-5 sm:pt-8">{children}</main>
      <NavAbas />
    </div>
  );
}
