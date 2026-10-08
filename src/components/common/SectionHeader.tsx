"use client";

import { ALPHA } from "@/lib/color";
import { useReveal } from "./useReveal";

type Props = {
  eyebrow: string;
  title?: string;
  /** Brand foreground color (runtime value — can't be a Tailwind class). */
  color: string;
  fontFamily?: string;
  /** Override the title's size/weight classes (showcase sections use two sizes). */
  titleClassName?: string;
  className?: string;
  eyebrowClassName?: string;
};

/**
 * The eyebrow-label + optional heading pair repeated ~6 times per showcase
 * page (pitch, features, vision, mission, links, others). Consolidates the
 * "font-mono text-[11px] tracking-widest uppercase" + brand-color styling
 * that was previously copy-pasted at each call site.
 */
export function SectionHeader({
  eyebrow,
  title,
  color,
  fontFamily,
  titleClassName,
  className,
  eyebrowClassName,
}: Props) {
  const reveal = useReveal();
  return (
    <div
      ref={reveal.ref as React.RefObject<HTMLDivElement>}
      className={`${reveal.className}${className ? ` ${className}` : ""}`}
    >
      <div
        className={
          eyebrowClassName ?? "font-mono text-[11px] tracking-widest uppercase mb-5"
        }
        style={{ color: color + ALPHA.solid }}
      >
        {eyebrow}
      </div>
      {title ? (
        <h2
          className={
            titleClassName ??
            "font-display text-3xl md:text-4xl font-semibold tracking-tightest"
          }
          style={{ fontFamily, color }}
        >
          {title}
        </h2>
      ) : null}
    </div>
  );
}
