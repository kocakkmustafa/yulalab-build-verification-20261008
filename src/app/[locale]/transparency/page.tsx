import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowUpRight,
  Receipt,
  Microscope,
  Lock,
  Eye,
  Cpu,
  ShieldCheck,
} from "@/components/common/icons";
import { EyebrowChip } from "@/components/common/EyebrowChip";
import { StaggerWords } from "@/components/common/StaggerWords";
import { getProjectBySlug } from "@/data/projects";
import { company } from "@/data/company";
import type { Locale, ProjectConfig } from "@/lib/types";
import { GlassSheen } from "@/components/common/GlassSheen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transparency" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: {
      canonical: locale === "tr" ? "/transparency" : `/${locale}/transparency`,
      languages: {
        tr: "/transparency",
        en: "/en/transparency",
      },
    },
  };
}

export default async function TransparencyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Transparency />;
}

type PillarSlug = "braavolabs" | "burunfarki" | "lifeos";

const PILLAR_ICONS = {
  braavolabs: Receipt,
  burunfarki: Microscope,
  lifeos: Lock,
} as const;

const PILLAR_DETAIL_ICONS = {
  braavolabs: ShieldCheck,
  burunfarki: Eye,
  lifeos: Cpu,
} as const;

function Transparency() {
  const t = useTranslations("transparency");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

  const pillars: PillarSlug[] = ["braavolabs", "burunfarki", "lifeos"];

  return (
    <div className="page-enter relative">
      <GlassSheen />
      <div className="ambient" aria-hidden />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[60vh] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(195,244,0,0.05), transparent 70%)",
          }}
        />
      </div>

      {/* HERO */}
      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-32 lg:pt-40 pb-12">
        <EyebrowChip>{t("eyebrow")}</EyebrowChip>
        <h1 className="mt-8 font-display font-extrabold text-ink-50 leading-[0.98] tracking-tightest text-[44px] sm:text-[60px] md:text-[72px]">
          <StaggerWords text={t("title")} />
        </h1>
        <p className="mt-8 text-[17px] leading-[1.7] text-ink-300 max-w-[60ch]">
          {t("intro")}
        </p>
      </section>

      {/* PROMISE */}
      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-8 pb-4">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-5">
          {t("promiseEyebrow")}
        </div>
        <p className="font-display text-[26px] md:text-[32px] leading-[1.25] tracking-tight text-ink-50 max-w-[32ch]">
          {t("promiseBody")}
        </p>
      </section>

      {/* THREE PILLARS */}
      <section className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-8">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-5">
          {t("pillarsEyebrow")}
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tightest text-ink-50 mb-12 max-w-[24ch]">
          {t("pillarsTitle")}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {pillars.map((slug) => {
            const project = getProjectBySlug(slug);
            if (!project) return null;
            return (
              <PillarCard
                key={slug}
                slug={slug}
                project={project}
                locale={locale}
                label={t(`pillars.${slug}.label`)}
                title={t(`pillars.${slug}.title`)}
                claim={t(`pillars.${slug}.claim`)}
                proof={t(`pillars.${slug}.proof`)}
                detailLabel={t(`pillars.${slug}.detailLabel`)}
                detailBody={t(`pillars.${slug}.detailBody`)}
                cta={t("readMore")}
              />
            );
          })}
        </div>
      </section>

      {/* WHAT YOU DO NOT GIVE UP */}
      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-24 pb-8">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-5">
          {t("guaranteeEyebrow")}
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tightest text-ink-50 mb-8">
          {t("guaranteeTitle")}
        </h2>
        <ul className="space-y-4">
          {(["dataOwnership", "noTraining", "noAds", "exitRight"] as const).map(
            (key) => (
              <li
                key={key}
                className="glass flex items-start gap-3 p-5"
              >
                <span
                  className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-md"
                  style={{
                    background: "rgba(195,244,0,0.10)",
                    border: "1px solid rgba(195,244,0,0.35)",
                  }}
                >
                  <ShieldCheck size={14} strokeWidth={2} className="text-ink-50" />
                </span>
                <div>
                  <div className="font-display font-semibold text-ink-50 text-[16px]">
                    {t(`guarantees.${key}.title`)}
                  </div>
                  <div className="text-[14px] leading-relaxed text-ink-300 mt-1">
                    {t(`guarantees.${key}.body`)}
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      </section>

      {/* CTA */}
      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-20 pb-32">
        <div className="glass p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-2">
              {t("ctaEyebrow")}
            </div>
            <div className="font-display text-2xl font-semibold text-ink-50 tracking-tight max-w-[28ch]">
              {t("ctaTitle")}
            </div>
            <div className="text-sm text-ink-300 mt-2">
              {t("ctaBody")} — {company.contact.email}
            </div>
          </div>
          <Link
            href="/manifesto"
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-[13.5px] hover:border-white/30 hover:bg-white/[0.04] transition-colors focusable"
          >
            {tc("readManifesto")}{" "}
            <ArrowUpRight size={14} strokeWidth={2} className="arrow-nudge" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function PillarCard({
  slug,
  project: p,
  locale,
  label,
  title,
  claim,
  proof,
  detailLabel,
  detailBody,
  cta,
}: {
  slug: PillarSlug;
  project: ProjectConfig;
  locale: Locale;
  label: string;
  title: string;
  claim: string;
  proof: string;
  detailLabel: string;
  detailBody: string;
  cta: string;
}) {
  const Icon = PILLAR_ICONS[slug];
  const DetailIcon = PILLAR_DETAIL_ICONS[slug];
  return (
    <div
      className="glass group p-6 flex flex-col"
      style={{ borderColor: `${p.brand.primary}1F` }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg"
          style={{
            background: p.brand.gradient,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -10px 18px rgba(0,0,0,0.35)",
          }}
        >
          <Icon size={18} strokeWidth={2} className="text-black/80" />
        </span>
        <span
          className="font-mono text-[10.5px] tracking-widest uppercase"
          style={{ color: `${p.brand.primary}DD` }}
        >
          {label}
        </span>
      </div>

      <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink-50">
        {p.name}
      </h3>
      <div className="mt-1 text-sm text-ink-400">{title}</div>

      <p className="mt-5 text-[15.5px] leading-relaxed text-ink-200">{claim}</p>

      <div className="glass mt-5 p-4">
        <div className="flex items-start gap-2.5">
          <DetailIcon
            size={15}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-ink-200"
          />
          <div>
            <div
              className="font-mono text-[10px] tracking-widest uppercase mb-1"
              style={{ color: `${p.brand.primary}CC` }}
            >
              {detailLabel}
            </div>
            <div className="text-[13.5px] leading-relaxed text-ink-300">
              {detailBody}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[13px] text-ink-300 font-mono">{proof}</div>

      <Link
        href={`/projects/${slug}`}
        className="mt-6 inline-flex items-center gap-2 text-[13.5px] text-ink-100 self-start link-wipe focusable"
        style={{ color: p.brand.primary }}
      >
        {cta} {p.name}
        <ArrowUpRight size={14} strokeWidth={2} className="arrow-nudge" />
      </Link>

      {/* avoid unused-var TS error when locale is not consumed */}
      <span hidden>{locale}</span>
    </div>
  );
}
