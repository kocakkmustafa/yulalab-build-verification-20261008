import { publicRegistry } from "@/data/public-registry";
import type { ProductPublicRecord, ProjectConfig, ProjectStat } from "./types";

/**
 * Links a stat card to the registry claim that already asserts its figure.
 *
 * Stat cards are the largest numbers on a product page and carried no
 * provenance at all, while the claim section below carried full provenance
 * AND a freshness marker for the same figures. When a claim lapsed, the
 * marked copy was flagged and the giant unmarked copy above it went on
 * asserting the number as current — which makes the freshness mechanism
 * decorative exactly where people look first.
 *
 * The link is explicit data (`claimId`), not inferred from the value. Same
 * reasoning as primaryCtaKind: a rule that guesses is right for one product
 * and silently wrong for the next, and a hand-maintained label drifts away
 * from what it describes.
 */
export function linkedClaimFor(
  slug: string,
  stat: ProjectStat,
  registry: readonly ProductPublicRecord[] = publicRegistry,
): ProductPublicRecord["claims"][number] | undefined {
  if (!stat.claimId) return undefined;
  const record = registry.find((r) => r.slug === slug);
  return record?.claims.find((c) => c.id === stat.claimId);
}

export type UnsourcedStat = {
  slug: string;
  value: string;
  labelEn: string;
};

/**
 * Quantitative stats with no claim behind them.
 *
 * Deliberately reported rather than forbidden. Several are structural
 * product facts ("5 life domains", "0 ads") rather than measurements, and
 * inventing sources for those would be worse than naming the gap. What
 * matters is that the set cannot quietly grow — see
 * tests/stat-provenance.test.ts.
 */
export function unsourcedQuantitativeStats(
  configs: readonly ProjectConfig[],
  registry: readonly ProductPublicRecord[],
): UnsourcedStat[] {
  const out: UnsourcedStat[] = [];
  for (const project of configs) {
    for (const stat of project.stats ?? []) {
      if (!/[0-9]/.test(stat.value)) continue;
      if (linkedClaimFor(project.slug, stat, registry)) continue;
      out.push({ slug: project.slug, value: stat.value, labelEn: stat.label.en });
    }
  }
  return out;
}
