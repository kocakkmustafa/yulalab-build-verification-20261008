"use client";

import type { ReactNode, RefObject } from "react";
import { useReveal } from "./useReveal";

type Props = {
  children: ReactNode;
  className?: string;
  /** Extra transition-delay (ms) — stagger a row of Reveals without needing
   *  Framer Motion's stagger machinery for simple, static section blocks. */
  delay?: number;
};

/**
 * Thin IntersectionObserver reveal wrapper for server-rendered section
 * blocks (eyebrow+heading pairs, columns) that don't need Framer Motion's
 * full machinery — just the same .reveal fade+rise every other scroll
 * moment on the site uses. Accepts server-rendered children as a prop,
 * which Next.js's App Router explicitly supports across the boundary.
 */
export function Reveal({ children, className, delay }: Props) {
  const reveal = useReveal();
  return (
    <div
      ref={reveal.ref as RefObject<HTMLDivElement>}
      className={`${reveal.className}${className ? ` ${className}` : ""}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
