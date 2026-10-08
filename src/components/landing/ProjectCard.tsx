"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "@/components/common/icons";
import { ProjectMonogram } from "@/components/common/ProjectMonogram";
import { StatusPill } from "@/components/common/StatusPill";
import { EASE_OUT, HOVER_SPRING } from "@/lib/motion";
import { ALPHA, HAIRLINE } from "@/lib/color";
import type { Locale, ProjectAsset, ProjectConfig } from "@/lib/types";

type ProductAsset = Extract<ProjectAsset, { kind: "product" }>;
function isProductShot(asset: ProjectAsset): asset is ProductAsset {
  return asset.kind === "product";
}

const MotionLink = motion.create(Link);

type Props =
  | { project: ProjectConfig; variant?: "compact" }
  | { project: ProjectConfig; variant: "big"; index: number; total: number };

/**
 * Single card component behind both the landing page's compact grid and the
 * /projects index's large grid — same data, same motion vocabulary, same
 * hover/tap physics, two deliberately different layouts (compact = dense
 * scan; big = one showcase-style hero per product). Previously two
 * hand-diverged components with duplicated hover logic.
 */
export function ProjectCard(props: Props) {
  return props.variant === "big" ? <BigCard {...props} /> : <CompactCard project={props.project} />;
}

function CompactCard({ project }: { project: ProjectConfig }) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;

  return (
    <MotionLink
      href={`/projects/${project.slug}`}
      className="group relative flex flex-col rounded-2xl border border-hairline bg-surface p-6 hover:bg-surface-raised focusable"
      style={{ borderColor: HAIRLINE }}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      whileHover={{ y: -4, borderColor: project.brand.primary + ALPHA.heavy, transition: HOVER_SPRING }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
    >
      <div className="flex items-start justify-between gap-3">
        <ProjectMonogram project={project} size={56} radius={12} />
        <StatusPill status={project.status} slug={project.slug} />
      </div>

      <div className="mt-7 font-mono text-[11px] tracking-widest uppercase text-ink-300">
        {project.category[locale]}
      </div>
      <h3
        className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink-50"
        style={{ fontFamily: project.brand.fontDisplay }}
      >
        {project.name}
      </h3>
      <p className="mt-2 text-[15px] text-ink-300 leading-relaxed">
        {project.tagline[locale]}
      </p>

      <div className="mt-8 pt-5 border-t border-white/5 flex items-center justify-between">
        <span className="text-[13px] text-ink-200">{t("explore")}</span>
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-hairline group-hover:border-hairline-strong transition-colors"
          style={{ color: project.brand.primary }}
        >
          <ArrowRight size={14} strokeWidth={2} className="arrow-nudge" />
        </span>
      </div>
    </MotionLink>
  );
}

function BigCard({
  project: p,
  index,
  total,
}: {
  project: ProjectConfig;
  index: number;
  total: number;
}) {
  const locale = useLocale() as Locale;
  const tc = useTranslations("common");
  // Status-gate: only a screenshot explicitly labeled "product" can replace
  // the monogram placeholder — same rule as the showcase hero (ProductShot).
  // A project with no real screen yet (LifeOS) keeps the honest monogram.
  const productShot = p.visuals.screenshots.find(isProductShot);

  return (
    <MotionLink
      href={`/projects/${p.slug}`}
      className="group block rounded-3xl overflow-hidden border border-hairline hover:border-hairline-strong bg-surface focusable"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: EASE_OUT, delay: Math.min(index, 5) * 0.08 },
      }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      whileHover={{ y: -4, transition: HOVER_SPRING }}
      whileTap={{ scale: 0.99, transition: { duration: 0.1 } }}
    >
      <div
        className="relative aspect-[16/10] overflow-hidden"
        style={{ background: p.brand.background }}
      >
        {productShot ? (
          <Image
            src={productShot.src}
            alt={productShot.alt}
            fill
            priority={index === 0}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
            style={{ transitionTimingFunction: "var(--ease-soft)" }}
          />
        ) : (
          <>
            <div
              className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]"
              style={{
                background: p.brand.gradient,
                opacity: 0.85,
                transition: "transform 800ms var(--ease-soft)",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="font-display font-extrabold tracking-tightest leading-none select-none"
                style={{
                  color: "rgba(0,0,0,0.55)",
                  fontSize: "clamp(120px, 20vw, 220px)",
                  fontFamily: p.brand.fontDisplay,
                  textShadow: "0 1px 0 rgba(255,255,255,0.18)",
                }}
              >
                {p.monogram}
              </div>
            </div>
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30" />
        <div className="absolute top-5 inset-x-5 flex items-start justify-between gap-3">
          <StatusPill status={p.status} slug={p.slug} />
          <span className="shrink-0 font-mono text-[10.5px] tracking-widest uppercase text-white/80">
            0{index + 1} / 0{total}
          </span>
        </div>
      </div>

      <div className="p-7 lg:p-9">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-300">
          {p.category[locale]}
        </div>
        <h3
          className="mt-2 font-display text-3xl md:text-4xl font-semibold tracking-tightest text-ink-50"
          style={{ fontFamily: p.brand.fontDisplay }}
        >
          {p.name}
        </h3>
        <p className="mt-2 text-[15.5px] text-ink-200">{p.tagline[locale]}</p>
        <p className="mt-4 text-[14.5px] text-ink-300 leading-relaxed max-w-[60ch]">
          {p.short[locale]}
        </p>

        <div className="mt-7 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-2 text-[13.5px]"
            style={{ color: p.brand.primary }}
          >
            <span className="arrow-nudge inline-flex">{tc("openPage")}</span>
            <ArrowRight size={14} strokeWidth={2} className="arrow-nudge" />
          </span>
          <div className="font-mono text-[11px] tracking-widest uppercase text-ink-300">
            / projects / {p.slug}
          </div>
        </div>
      </div>
    </MotionLink>
  );
}
