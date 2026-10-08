import type { ProductPublicRecord, ProjectStat, Locale } from "@/lib/types";
import { isExpired } from "@/lib/public-registry";
import { linkedClaimFor } from "@/lib/stat-provenance";

/**
 * The big numbers at the top of a product page.
 *
 * A stat card carrying no provenance sat directly above a claim card
 * carrying full provenance and a freshness marker — for the SAME figure. On
 * the day a claim lapsed, the small print said "needs re-verification" and
 * 42px type above it went on asserting the number as current, which makes
 * the freshness mechanism decorative exactly where people look first.
 *
 * Linked cards now inherit the claim's verification date and its staleness.
 * Unlinked cards render as before; several are structural product facts
 * ("5 life domains", "0 ads") rather than measurements, and stamping those
 * with an invented source would be worse than leaving them plain.
 *
 * Pure and hook-free so it can be rendered in a test — the previous
 * inline-in-ProductPage version could only be guarded by grepping the file,
 * and a reviewer showed that such a guard survives the section being deleted
 * outright.
 */
export function StatCards({
  slug,
  stats,
  record,
  locale,
  now,
  labels,
}: {
  slug: string;
  stats: ProjectStat[];
  record: ProductPublicRecord | undefined;
  locale: Locale;
  now: Date;
  labels: { verified: string; needsReverification: string };
}) {
  if (stats.length === 0) return null;

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 pb-24">
      {stats.map((stat) => {
        // Via the shared helper, not a second inline lookup. The tests
        // exercised linkedClaimFor while this component re-implemented it —
        // so the function under test was not the function that shipped, and
        // a reviewer gutted this resolution (`record?.claims[0]`) with the
        // whole suite still green.
        const claim = linkedClaimFor(slug, stat, record ? [record] : []);
        const stale = claim ? isExpired(claim.expiresAt, now) : false;

        return (
          <div key={stat.label[locale]} className="glass glass-accent p-6 lg:p-8">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-300 mb-3.5">
              {stat.label[locale]}
            </div>
            <div className="font-display font-extralight text-[clamp(26px,3vw,42px)] leading-none tracking-tightest">
              {stat.value}
            </div>
            {claim ? (
              <div className="mt-4 font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-300">
                {stale ? (
                  // In words, not by colour alone — the whole point is that
                  // this reads as "not currently verified", including to a
                  // reader who cannot see the tint.
                  <span className="text-amber-300/90 normal-case tracking-normal">
                    {labels.needsReverification}
                  </span>
                ) : (
                  <span>
                    {labels.verified} {claim.verifiedAt}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
