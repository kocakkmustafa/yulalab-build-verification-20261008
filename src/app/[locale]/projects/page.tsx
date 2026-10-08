import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { EyebrowChip } from "@/components/common/EyebrowChip";
import { StaggerWords } from "@/components/common/StaggerWords";
import { ProjectCard } from "@/components/landing/ProjectCard";
import { projects } from "@/data/projects";
import { publicRegistry } from "@/data/public-registry";
import { partitionForIndex } from "@/lib/product-index";
import { GlassSheen } from "@/components/common/GlassSheen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projectsIndex" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: {
      canonical: locale === "tr" ? "/projects" : `/${locale}/projects`,
    },
  };
}

export default async function ProjectsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProjectsIndex />;
}

function ProjectsIndex() {
  const t = useTranslations("projectsIndex");

  // Lifecycle comes from the registry; the card still renders from
  // ProjectConfig. Two sources is the known Y-P0-003 debt — reading the
  // grouping from the registry at least keeps "what is shipped" answered in
  // one place while the merge waits for its own slice.
  const bySlug = new Map(projects.map((p) => [p.slug, p]));
  const partition = partitionForIndex(publicRegistry);
  const toConfigs = (records: typeof partition.primary) =>
    records.map((r) => bySlug.get(r.slug)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const shipped = toConfigs(partition.primary);
  const research = toConfigs(partition.research);

  return (
    <div className="page-enter relative">
      <GlassSheen />
      <div className="ambient" aria-hidden />
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-32 lg:pt-40 pb-12">
        <EyebrowChip>{t("eyebrow")}</EyebrowChip>
        <h1 className="mt-7 font-display font-extrabold text-ink-50 leading-[0.96] tracking-tightest text-[44px] sm:text-[60px] md:text-[80px]">
          <StaggerWords text={t("title")} />
        </h1>
        <p className="mt-7 max-w-[58ch] text-[16.5px] leading-[1.65] text-ink-300">
          {t("intro")}
        </p>
      </section>

      {/* Shipped first, research separately. One flat grid of eight cards
          reads as eight products, and five of ours cannot be downloaded —
          roadmap §1.3 forbids giving coming-soon equal weight in the main
          proof section. Grouping comes from the public registry's lifecycle
          field, so this page and the JSON the links hub fetches cannot
          disagree about what is shipped. */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-6 pb-12">
        <h2 className="font-mono text-[11px] tracking-[0.22em] uppercase text-ink-300">
          {t("shippedHeading")}
        </h2>
        <p className="mt-3 max-w-[58ch] text-[14.5px] leading-[1.65] text-ink-300">
          {t("shippedNote")}
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {shipped.map((p, i) => (
            <ProjectCard
              key={p.slug}
              project={p}
              variant="big"
              index={i}
              total={shipped.length}
            />
          ))}
        </div>
      </section>

      {research.length > 0 ? (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
          {/* The heading and the explanation sit OUTSIDE the <details> on
              purpose. Inside, they would be invisible until expanded — so
              the document outline would nest five research products under
              "Shipped", and the reason they are held back would be hidden
              behind a click. The disclosure hides the cards, never the
              caveat.

              <details> rather than a JS toggle: collapsed by default, works
              with no JavaScript, keyboard-operable and announced by screen
              readers for free. */}
          <h2 className="font-mono text-[11px] tracking-[0.22em] uppercase text-ink-300">
            {t("researchHeading")}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.7] text-ink-300">
            {t("researchNote")}
          </p>
          <details className="glass mt-8 p-6 lg:p-8">
            <summary className="cursor-pointer font-mono text-[11px] tracking-[0.22em] uppercase text-ink-300 focusable">
              {t("researchToggle", { count: research.length })}
            </summary>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {research.map((p, i) => (
                <ProjectCard
                  key={p.slug}
                  project={p}
                  variant="big"
                  index={i}
                  total={research.length}
                />
              ))}
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
