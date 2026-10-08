"use client";

import { useEffect, useRef, useState } from "react";

export type Scene = { id: string; label: string };

/**
 * Right-edge scene indicator: where you are in the scroll, as a thin
 * lit thread — the same visual language as the filament field.
 *
 * It is a real nav landmark with real anchors, so it works with keyboard
 * and screen readers; the active state is carried by aria-current rather
 * than by colour alone.
 */
export function SceneRail({ scenes, label }: { scenes: Scene[]; label: string }) {
  const [active, setActive] = useState(scenes[0]?.id ?? "");
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const els = scenes
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;

    // a narrow band across the middle of the viewport: the section that
    // occupies the reader's centre of attention is the active one
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [scenes]);

  return (
    <nav
      ref={ref}
      aria-label={label}
      className="fixed right-3 lg:right-7 top-1/2 -translate-y-1/2 z-40 hidden sm:flex flex-col gap-0.5"
    >
      {scenes.map((s) => {
        const on = s.id === active;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={on ? "true" : undefined}
            className={
              "group flex items-center justify-end gap-3 py-[7px] focusable transition-colors duration-300 ease-soft " +
              (on ? "text-[#B8F0F5]" : "text-ink-400 hover:text-ink-200")
            }
          >
            <span
              className={
                // `xl`, matching the `xl:pr-32` gutter the sections reserve.
                // Revealing labels at `lg` put them over section copy in the
                // 1024–1280 band, where no gutter exists yet.
                "hidden xl:block font-mono text-[10px] tracking-[0.16em] uppercase transition-opacity duration-300 ease-soft " +
                (on ? "opacity-100" : "opacity-45 group-hover:opacity-80")
              }
            >
              {s.label}
            </span>
            <span
              aria-hidden
              className="block h-px bg-current transition-all duration-300 ease-soft"
              style={
                on
                  ? { width: 34, boxShadow: "0 0 10px #4FA8B8" }
                  : { width: 14, opacity: 0.6 }
              }
            />
          </a>
        );
      })}
    </nav>
  );
}
