"use client";

import { ArrowUpRight, Mail } from "@/components/common/icons";
import { useReveal } from "@/components/common/useReveal";

type Props = {
  label: string;
  address: string;
  hint: string;
  accent?: string;
};

export function MailCard({ label, address, hint, accent = "#F4F4F5" }: Props) {
  const reveal = useReveal();
  return (
    <a
      ref={reveal.ref as React.RefObject<HTMLAnchorElement>}
      href={`mailto:${address}`}
      className={
        "group relative block rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 transition-all duration-300 focusable card-hover hover:border-white/20 hover:bg-white/[0.04] " +
        reveal.className
      }
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 text-ink-100">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-white/10 bg-white/[0.03]">
              <Mail size={16} strokeWidth={1.6} />
            </span>
            <span className="font-mono text-[11px] tracking-widest uppercase text-ink-300">
              {label}
            </span>
          </div>
          <div className="mt-6 [overflow-wrap:anywhere] font-display text-2xl md:text-[28px] font-semibold tracking-tight text-ink-50">
            {address}
          </div>
          <p className="mt-2 text-[14px] text-ink-400 max-w-[40ch]">{hint}</p>
        </div>
        <span className="hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 group-hover:border-white/25 transition-colors text-ink-100 shrink-0">
          <ArrowUpRight size={14} strokeWidth={2} className="arrow-nudge" />
        </span>
      </div>
      <div
        className="absolute left-0 top-6 bottom-6 w-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{ background: accent, boxShadow: `0 0 14px ${accent}99` }}
      />
    </a>
  );
}
