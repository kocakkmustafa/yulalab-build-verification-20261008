import type { ReactNode } from "react";

export function EyebrowChip({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] pl-2 pr-3 py-1.5 text-[11.5px] font-mono tracking-widest uppercase text-ink-200">
      <span
        className="w-1.5 h-1.5 rounded-full bg-emerald-400/80"
        style={{ boxShadow: "0 0 10px rgba(110,231,183,0.7)" }}
      />
      {children}
    </div>
  );
}
