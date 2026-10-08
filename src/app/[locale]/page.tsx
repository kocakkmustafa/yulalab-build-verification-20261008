import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { YulaExperience } from "@/components/experience/YulaExperience";
import type {
  ExperienceCopy,
  ExperienceProduct,
} from "@/components/experience/types";
import { company } from "@/data/company";
import { projects } from "@/data/projects";
import { publicRegistry } from "@/data/public-registry";
import type { Locale, ProductLifecycle } from "@/lib/types";

const CANONICAL_PRODUCT_ORDER = [
  "braavolabs",
  "burunfarki",
  "lifeos",
  "gravita",
  "lissom",
  "jablab",
  "ostinato",
  "choreia",
] as const;

function isLocale(value: string): value is Locale {
  return value === "tr" || value === "en";
}

function localizeInternalRoute(route: string, locale: Locale): string {
  if (!route.startsWith("/") || route.startsWith("//")) {
    throw new Error(`Homepage product CTA must be an internal route: ${route}`);
  }
  if (locale === "tr") return route;
  return route === "/" ? "/en" : `/en${route}`;
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "experience" });

  const projectSlugs = projects.map((project) => project.slug);
  if (projectSlugs.join("|") !== CANONICAL_PRODUCT_ORDER.join("|")) {
    throw new Error(
      `Homepage project order drifted: expected ${CANONICAL_PRODUCT_ORDER.join(", ")}; received ${projectSlugs.join(", ")}`,
    );
  }

  const registryBySlug = new Map<string, (typeof publicRegistry)[number]>();
  for (const record of publicRegistry) {
    if (registryBySlug.has(record.slug)) {
      throw new Error(`Duplicate public registry record for homepage product: ${record.slug}`);
    }
    registryBySlug.set(record.slug, record);
  }

  const unexpectedRecords = publicRegistry.filter(
    (record) => !projectSlugs.includes(record.slug),
  );
  if (unexpectedRecords.length > 0 || publicRegistry.length !== projects.length) {
    throw new Error(
      `Homepage registry/project join is not one-to-one; unexpected records: ${unexpectedRecords.map((record) => record.slug).join(", ") || "none"}`,
    );
  }

  const lifecycleLabels: Record<ProductLifecycle, string> = {
    live: t("lifecycle.live"),
    beta: t("lifecycle.beta"),
    research: t("lifecycle.research"),
    archived: t("lifecycle.archived"),
  };

  const experienceProducts: ExperienceProduct[] = projects.map((project) => {
    const record = registryBySlug.get(project.slug);
    if (!record) {
      throw new Error(`Missing public registry record for homepage product: ${project.slug}`);
    }
    if (record.name !== project.name) {
      throw new Error(
        `Homepage product name mismatch for ${project.slug}: ${project.name} != ${record.name}`,
      );
    }

    const expectedRoute = `/projects/${project.slug}`;
    if (record.primaryCta.url !== expectedRoute) {
      throw new Error(
        `Homepage product route mismatch for ${project.slug}: expected ${expectedRoute}; received ${record.primaryCta.url}`,
      );
    }

    return {
      slug: project.slug,
      name: project.name,
      monogram: project.monogram,
      lifecycle: record.lifecycle,
      category: project.category[locale],
      tagline: project.tagline[locale],
      short: project.short[locale],
      href: localizeInternalRoute(record.primaryCta.url, locale),
      ctaLabel:
        record.lifecycle === "research"
          ? t("portfolio.researchAction")
          : t("portfolio.liveAction"),
      lifecycleLabel: lifecycleLabels[record.lifecycle],
      colors: {
        primary: project.brand.primary,
        secondary: project.brand.secondary,
        accent: project.brand.accent,
        background: project.brand.background,
      },
      // Only registry-declared captures can enter the experience. Project
      // atmosphere assets and product-page mockups are intentionally absent.
      screenshots: record.screenshots.map((screenshot) => ({
        path: screenshot.path,
        alt: locale === "tr" ? screenshot.altTr : screenshot.altEn,
        sourceBuild: screenshot.sourceBuild,
        capturedAt: screenshot.capturedAt,
      })),
      // Claim prose and every provenance field travel as one indivisible
      // record so the client cannot display a figure without its caveat.
      claims: record.claims.map((claim) => ({
        id: claim.id,
        figure: claim.figures?.join(" · ") ?? null,
        statement: locale === "tr" ? claim.statementTr : claim.statementEn,
        evidenceKind: claim.evidenceKind,
        source: claim.source,
        scope: locale === "tr" ? claim.scopeTr : claim.scopeEn,
        verifiedAt: claim.verifiedAt,
        expiresAt: claim.expiresAt,
      })),
      updatedAt: record.updatedAt,
    };
  });

  const lifecycleCounts = experienceProducts.reduce(
    (counts, product) => {
      counts[product.lifecycle] += 1;
      return counts;
    },
    { live: 0, beta: 0, research: 0, archived: 0 },
  );

  const copy: ExperienceCopy = {
    locale,
    navigation: {
      home: t("navigation.home"),
      consulting: t("navigation.consulting"),
      projects: t("navigation.projects"),
      manifesto: t("navigation.manifesto"),
      transparency: t("navigation.transparency"),
      contact: t("navigation.contact"),
      soundOn: t("navigation.soundOn"),
      soundOff: t("navigation.soundOff"),
    },
    loader: [
      t("loader.geometry"),
      t("loader.registry"),
      t("loader.material"),
      t("loader.ready"),
    ],
    hero: {
      eyebrow: t("hero.eyebrow"),
      title: t("hero.title"),
      lede: t("hero.lede"),
      notice: t("hero.notice", {
        liveCount: lifecycleCounts.live,
        betaCount: lifecycleCounts.beta,
        researchCount: lifecycleCounts.research,
      }),
      scroll: t("hero.scroll"),
    },
    portfolio: {
      kicker: t("portfolio.kicker"),
      liveAction: t("portfolio.liveAction"),
      researchAction: t("portfolio.researchAction"),
      noPublicBuild: t("portfolio.noPublicBuild"),
      productCounter: t("portfolio.productCounter"),
    },
    proof: {
      kicker: t("proof.kicker"),
      title: t("proof.title"),
      source: t("proof.source"),
      scope: t("proof.scope"),
      verified: t("proof.verified"),
      stale: t("proof.stale"),
      freshnessPending: t("proof.freshnessPending"),
      refreshDue: t("proof.refreshDue"),
    },
    mission: {
      kicker: t("mission.kicker"),
      title: t("mission.title"),
      body: company.mission[locale],
    },
    vision: {
      kicker: t("vision.kicker"),
      title: t("vision.title"),
      body: company.vision[locale],
    },
    values: {
      kicker: t("values.kicker"),
      title: t("values.title"),
      items: company.values.map((value) => ({
        title: value.title[locale],
        description: value.description[locale],
      })),
    },
    closing: {
      kicker: t("closing.kicker"),
      title: t("closing.title"),
      body: t("closing.body"),
      email: company.contact.email,
      privacy: t("closing.privacy"),
      terms: t("closing.terms"),
      support: t("closing.support"),
      rights: t("closing.rights"),
    },
    fallback: {
      label: t("fallback.label"),
      reason: t("fallback.reason"),
    },
  };

  return <YulaExperience products={experienceProducts} copy={copy} />;
}
