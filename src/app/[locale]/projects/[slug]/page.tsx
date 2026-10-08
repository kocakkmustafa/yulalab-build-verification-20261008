import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProjectBySlug, getProjectSlugs } from "@/data/projects";
import { ProductPage } from "@/components/projects/ProductPage";
import { routing } from "@/i18n/routing";
import { notFoundMetadata } from "@/lib/not-found-metadata";
import type { Locale } from "@/lib/types";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/**
 * Regenerate at most every 15 minutes.
 *
 * Without this the route is a pure build-time prerender —
 * `initialRevalidateSeconds: false` in .next/prerender-manifest.json — so
 * the claim-freshness check ran exactly once, at build. A reviewer proved it
 * by running the server with the clock shifted +7 days: the response was
 * byte-identical to the prerendered HTML, `x-nextjs-cache: HIT`, with no
 * lapsed markers on a claim that had already expired.
 *
 * That mattered more than ordinary staleness. workspace/
 * TASARIM-RISKI-STORE-EXPIRY-BUILD.md took expiry OUT of the build gate on
 * the stated premise that server components re-render per request so it
 * "self-corrects without a new deploy". They do not when the route is
 * prerendered, so neither gate caught it: deploy on the 19th, don't deploy
 * again, and from the 22nd the site publishes an expired figure under the
 * heading "Verified claims" — roadmap §17's exact prohibition.
 *
 * 900s keeps the page static for virtually every visitor while bounding how
 * long a lapsed claim can be presented as current. `dynamic = "force-dynamic"`
 * would also fix it and costs a render per request for no extra honesty.
 */
export const revalidate = 900;

export async function generateStaticParams() {
  const slugs = getProjectSlugs();
  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = getProjectBySlug(slug);
  const lang = locale as Locale;
  if (!project) return notFoundMetadata(lang);
  return {
    title: project.name,
    description: project.tagline[lang],
    alternates: {
      canonical: locale === "tr" ? `/projects/${slug}` : `/${locale}/projects/${slug}`,
      languages: {
        tr: `/projects/${slug}`,
        en: `/en/projects/${slug}`,
      },
    },
    openGraph: {
      title: `${project.name} — ${project.tagline[lang]}`,
      description: project.description[lang],
      images: [
        { url: `/projects/${slug}/opengraph-image`, width: 1200, height: 630 },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.name} — ${project.tagline[lang]}`,
      description: project.description[lang],
      images: [`/projects/${slug}/opengraph-image`],
    },
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  return <ProductPage project={project} />;
}
