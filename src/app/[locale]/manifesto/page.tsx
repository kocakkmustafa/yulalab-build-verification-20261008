import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight } from "@/components/common/icons";
import { EyebrowChip } from "@/components/common/EyebrowChip";
import { StaggerWords } from "@/components/common/StaggerWords";
import { ValueCard } from "@/components/manifesto/ValueCard";
import { company } from "@/data/company";
import type { Locale } from "@/lib/types";
import { GlassSheen } from "@/components/common/GlassSheen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "manifesto" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: {
      canonical: locale === "tr" ? "/manifesto" : `/${locale}/manifesto`,
    },
  };
}

export default async function ManifestoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Manifesto />;
}

function Manifesto() {
  const t = useTranslations("manifesto");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

  return (
    <div className="page-enter relative">
      <GlassSheen />
      <div className="ambient" aria-hidden />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[60vh] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.04), transparent 70%)",
          }}
        />
      </div>

      <article className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-32 lg:pt-40 pb-10">
        <EyebrowChip>{t("eyebrow")}</EyebrowChip>
        <h1 className="mt-8 font-display font-extrabold text-ink-50 leading-[0.98] tracking-tightest text-[44px] sm:text-[60px] md:text-[72px]">
          <StaggerWords text={t("title")} />
        </h1>
        <p className="mt-8 text-[17px] leading-[1.7] text-ink-300 max-w-[58ch]">
          {t("intro")}
        </p>
      </article>

      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-4 pb-4">
        <div className="glass p-7">
          <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-4">
            {t("nameEyebrow")}
          </div>
          <p className="font-display text-xl md:text-2xl font-semibold tracking-tight text-ink-50 max-w-[24ch]">
            {t("nameTitle")}
          </p>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.7] text-ink-300">
            {t("nameBody")}
          </p>
        </div>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-12">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-5">
          {t("visionEyebrow")}
        </div>
        <p className="font-display text-[28px] md:text-[36px] leading-[1.2] tracking-tight text-ink-50 max-w-[28ch]">
          {company.vision[locale]}
        </p>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-16">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-5">
          {t("missionEyebrow")}
        </div>
        <p className="font-display text-[28px] md:text-[36px] leading-[1.2] tracking-tight text-ink-50 max-w-[28ch]">
          {company.mission[locale]}
        </p>
      </section>

      <section className="relative max-w-5xl mx-auto px-6 lg:px-10 pt-24">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-5">
          {t("valuesEyebrow")}
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tightest text-ink-50">
          {t("valuesTitle")}
        </h2>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {company.values.map((v, i) => (
            <ValueCard
              key={v.title.tr}
              index={i}
              title={v.title}
              description={v.description}
            />
          ))}
        </div>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-24 pb-8">
        <div className="glass p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-2">
              {t("founderEyebrow")}
            </div>
            <div className="font-display text-2xl font-semibold text-ink-50 tracking-tight">
              {company.founder.name}
            </div>
            <div className="text-sm text-ink-300 mt-1">
              {company.founder.role[locale]}
            </div>
          </div>
          <Link
            href="/contact"
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-[13.5px] hover:border-white/30 hover:bg-white/[0.04] transition-colors focusable"
          >
            {tc("getInTouch")}{" "}
            <ArrowUpRight size={14} strokeWidth={2} className="arrow-nudge" />
          </Link>
        </div>
      </section>
    </div>
  );
}
