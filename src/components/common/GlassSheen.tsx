"use client";

import { useEffect } from "react";

/**
 * Drives the `.glass::before` sheen highlight.
 *
 * One delegated listener on the document rather than a `pointermove`
 * handler per panel, throttled to a frame, writing only two custom
 * properties. The visual result is a light that follows the cursor across
 * a pane; the cost is two number writes per frame on a single element.
 *
 * What it deliberately does not do: rewrite `background-image`, `box-shadow`
 * or `transform` on a backdrop-filtered element. Each of those forces the
 * blur behind the panel to re-resolve, and doing it from a pointer event on
 * a page with a dozen glass panes is what makes a page feel like it's
 * dragging.
 */
export function GlassSheen() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    let raf = 0;
    let pending: { el: HTMLElement; x: number; y: number } | null = null;

    const flush = () => {
      raf = 0;
      if (!pending) return;
      const { el, x, y } = pending;
      pending = null;
      el.style.setProperty("--mx", `${x.toFixed(1)}%`);
      el.style.setProperty("--my", `${y.toFixed(1)}%`);
    };

    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>(".glass");
      if (!el) return;
      // one rect read per frame, not per event
      const r = el.getBoundingClientRect();
      pending = {
        el,
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      };
      if (!raf) raf = requestAnimationFrame(flush);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
