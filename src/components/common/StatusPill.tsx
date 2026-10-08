"use client";

import { useTranslations } from "next-intl";
import type { ProjectStatus } from "@/lib/types";
import { STATUS_KEY } from "@/lib/types";
import { publicRegistry } from "@/data/public-registry";
import { presentSurfaces } from "@/lib/proof";

const TONE: Record<ProjectStatus, string> = {
  live: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  beta: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  "coming-soon": "bg-ink-50/5 text-ink-200 border-white/10",
  "in-development": "bg-ink-50/5 text-ink-200 border-white/10",
};

export function StatusPill({ status, slug }: { status: ProjectStatus; slug: string }) {
  const t = useTranslations("status");
  const product = useTranslations("product");
  const record = publicRegistry.find((r) => r.slug === slug);
  const publicationConfirmed = record && presentSurfaces(record, new Date()).some(
    ({ surface, statusConfirmed }) => statusConfirmed &&
      (surface.status === "live" || (status === "beta" && surface.status === "beta")),
  );
  const needsPublicationCheck = (status === "live" || status === "beta") && !publicationConfirmed;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase " +
        TONE[needsPublicationCheck ? "in-development" : status]
      }
    >
      <span aria-hidden="true" className="w-1 h-1 shrink-0 rounded-full bg-current" />
      {needsPublicationCheck ? product("availabilityUnverified") : t(STATUS_KEY[status])}
    </span>
  );
}
