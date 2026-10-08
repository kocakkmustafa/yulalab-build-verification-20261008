"use client";

import { useLocale } from "next-intl";
import { useReveal } from "@/components/common/useReveal";
import type { Locale } from "@/lib/types";

type Props = {
  index: number;
  title: { tr: string; en: string };
  description: { tr: string; en: string };
};

export function ValueCard({ index, title, description }: Props) {
  const locale = useLocale() as Locale;
  const reveal = useReveal();

  return (
    <div
      ref={reveal.ref as React.RefObject<HTMLDivElement>}
      className={
        "card-hover rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 hover:bg-white/[0.04] hover:border-white/15 " +
        reveal.className
      }
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10.5px] tracking-widest uppercase text-ink-400">
          0{index + 1}
        </span>
        <h3 className="font-display text-[22px] font-semibold tracking-tight text-ink-50">
          {title[locale]}
        </h3>
      </div>
      <p className="mt-3 text-[15px] text-ink-300 leading-[1.6] max-w-[40ch]">
        {description[locale]}
      </p>
    </div>
  );
}
