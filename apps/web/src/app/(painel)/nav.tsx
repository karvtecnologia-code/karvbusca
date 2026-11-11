"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Lotes", curto: "Lotes", icone: "M4 6h16M4 12h16M4 18h10" },
  { href: "/favoritos", label: "Favoritos", curto: "Favoritos", icone: "M12 17.3 6.2 20.6l1.1-6.5L2.6 9.5l6.5-.9L12 2.7l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5z" },
  { href: "/termos", label: "Termos", curto: "Termos", icone: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4" },
  { href: "/saude", label: "Saúde", curto: "Saúde", icone: "M3 12h4l3-7 4 14 3-7h4" },
  { href: "/configuracoes", label: "Configurações", curto: "Ajustes", icone: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];

const ativoEm = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Abas do topo (PC e tablet). */
export function Nav() {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex gap-1">
      {LINKS.map((l) => {
        const ativo = ativoEm(path, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={ativo ? "page" : undefined}
            className={`press rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap ${ativo ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra de abas fixa embaixo, só no celular. */
export function NavAbas() {
  const path = usePathname();
  return (
    <nav
      aria-label="Seções"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="grid grid-cols-5">
        {LINKS.map((l) => {
          const ativo = ativoEm(path, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={ativo ? "page" : undefined}
                className={`press flex h-14 flex-col items-center justify-center gap-1 text-[11px] ${ativo ? "text-amber" : "text-muted"}`}
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={l.icone} />
                </svg>
                {l.curto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
