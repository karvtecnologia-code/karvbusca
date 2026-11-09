"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Lotes" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/termos", label: "Termos" },
  { href: "/saude", label: "Saúde" },
  { href: "/ajustes", label: "Ajustes" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto">
      {LINKS.map((l) => {
        const ativo = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={ativo ? "page" : undefined}
            className={`press rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap ${
              ativo ? "bg-raised text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
