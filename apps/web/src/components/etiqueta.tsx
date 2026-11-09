import type { Tom } from "@/lib/lotes";

const TONS: Record<Tom, string> = {
  ok: "border-ok/35 bg-ok/10 text-[#8fc9a1]",
  warn: "border-amber/30 bg-amber/10 text-[#f3c36f]",
  bad: "border-bad/40 bg-bad/12 text-[#e0938f]",
  neutro: "border-line-strong bg-raised text-muted",
};

export function Etiqueta({ tom = "neutro", children, title }: { tom?: Tom; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex h-5 items-center rounded border px-1.5 text-[11px] leading-none font-medium whitespace-nowrap ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}
