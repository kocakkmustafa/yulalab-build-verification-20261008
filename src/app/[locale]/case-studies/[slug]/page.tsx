import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { GlassSheen } from "@/components/common/GlassSheen";
import { CaseStudyPage } from "@/components/case-studies/CaseStudyPage";
import { caseStudies } from "@/data/case-studies";
import { publicRegistry } from "@/data/public-registry";
import { publishableCaseStudies } from "@/lib/case-studies";
import { notFoundMetadata } from "@/lib/not-found-metadata";
import type { Locale } from "@/lib/types";
import { routing } from "@/i18n/routing";

/**
 * Only PUBLISHABLE cases get a route. A case that fails the gate is not a
 * 200 page with a warning on it — it does not exist publicly at all.
 */
export function generateStaticParams() {
  const published = publishableCaseStudies(caseStudies, publicRegistry);
  return routing.locales.flatMap((locale) =>
    published.map((study) => ({ locale, slug: study.slug })),
  );
}

/**
 * Time-dependent: publishableCaseStudies() withdraws a case whose own
 * verification window has closed, or whose source claim has lapsed. Frozen
 * at build, that gate would never fire in production — a withdrawn case
 * would stay published until somebody happened to deploy.
 */
export const revalidate = 900;

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const study = publishableCaseStudies(caseStudies, publicRegistry).find((s) => s.slug === slug);
  if (!study) return notFoundMetadata(locale as Locale);
  const tr = locale === "tr";
  return {
    title: tr ? study.titleTr : study.titleEn,
    description: `${tr ? study.outcome.metricTr : study.outcome.metricEn} — ${study.outcome.figure}`,
    alternates: {
      canonical: tr ? `/case-studies/${slug}` : `/${locale}/case-studies/${slug}`,
    },
  };
}

export default async function CaseStudyRoute({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const study = publishableCaseStudies(caseStudies, publicRegistry).find((s) => s.slug === slug);
  if (!study) notFound();
  // publishableCaseStudies has already proven this exists and is unlapsed;
  // re-deriving it here keeps the component's required prop honest.
  const claim = publicRegistry
    .find((r) => r.slug === study.productSlug)
    ?.claims.find((c) => c.id === study.outcome.claimId);
  if (!claim) notFound();
  return (
    <div className="page-enter relative">
      <GlassSheen />
      <div className="ambient" aria-hidden />
      <CaseStudyPage study={study} claim={claim} />
    </div>
  );
}
