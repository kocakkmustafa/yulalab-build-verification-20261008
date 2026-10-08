import type { ReactNode } from "react";
import { GlassSheen } from "@/components/common/GlassSheen";

/**
 * The frame every non-landing route sits in.
 *
 * Three things every page needs and none should re-declare: the ambient
 * ground the glass panes blur against, the pointer-sheen driver, and
 * enough top padding to clear the fixed 65px header. Before this existed
 * each route hand-rolled its own spacing and the pages drifted apart.
 *
 * `accent` tints the ambient field — product-adjacent routes can carry
 * their product's hue; the rest inherit the studio cyan.
 */
export function PageShell({
  children,
  accent,
  className = "",
}: {
  children: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={"page-enter relative min-h-screen " + className}
      style={accent ? ({ ["--accent" as string]: accent } as React.CSSProperties) : undefined}
    >
      <GlassSheen />
      <div className="ambient" aria-hidden />
      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 pt-28 pb-24">
        {children}
      </div>
    </div>
  );
}

/** Kicker + title + optional lede — the opening of every inner page. */
export function PageHeader({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
}) {
  return (
    <header className="pb-16">
      <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-ink-400 mb-8">
        {kicker}
      </p>
      <h1 className="font-display font-light text-[clamp(34px,5.2vw,72px)] leading-[1.04] tracking-tightest max-w-[20ch] text-pretty">
        {title}
      </h1>
      {lede ? (
        <p className="mt-7 max-w-[54ch] text-[clamp(15.5px,1.2vw,17.5px)] leading-[1.72] text-ink-300 text-pretty">
          {lede}
        </p>
      ) : null}
    </header>
  );
}
