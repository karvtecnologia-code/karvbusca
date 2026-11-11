import { sair } from "../login/actions";
import { Nav } from "./nav";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        {/* celular: marca + Sair em cima, abas roláveis embaixo; PC: tudo numa linha */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4 pt-2 sm:h-14 sm:flex-nowrap sm:pt-0">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">KarvBusca</span>
          </div>
          <div className="order-last -mx-4 w-[calc(100%+2rem)] px-3 pb-1.5 sm:order-none sm:mx-0 sm:w-auto sm:px-0 sm:pb-0">
            <Nav />
          </div>
          <form action={sair} className="ml-auto">
            <button className="press text-xs text-muted hover:text-fg">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-8">{children}</main>
    </div>
  );
}
