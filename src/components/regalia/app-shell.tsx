import Link from "next/link";
import { brand } from "@/lib/site-config";

export function AppShell({
  children,
  eyebrow,
  title,
  actions,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-ink text-warm-white">
      <header className="border-b border-champagne/15 bg-ink-deep/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center border border-champagne/40 text-[10px] tracking-[0.18em] text-champagne">
              LR
            </span>
            <span>
              <span className="block font-display text-lg tracking-[0.28em]">
                {brand.name}
              </span>
              <span className="text-[8px] uppercase tracking-[0.36em] text-champagne/70">
                {eyebrow}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">{actions}</div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-[clamp(2rem,4vw,3.1rem)] text-warm-white">
          {title}
        </h1>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
