import type { PresentedClaim } from "@/lib/proof";
import { ProofCard } from "@/components/common/ProofCard";

/**
 * The product page's proof block.
 *
 * Pure and hook-free on purpose: every label arrives as a prop so this can
 * be rendered in a test without next-intl or a server-component runtime.
 * The previous version lived inline in ProductPage, where the only guard was
 * a source-level grep — and a reviewer showed that deleting the entire
 * rendered section, or filtering lapsed claims out of it, left all 50 tests
 * green. A component you can actually render is the fix; see
 * tests/claims-section.test.tsx.
 *
 * Lapsed claims sit under their OWN heading rather than mixed into the
 * verified list. proof.ts says a lapsed claim "may not appear in the
 * verified block"; while both groups shared one <ul> under one heading that
 * sentence was aspirational, separated only by fine print and a border tint.
 */
export function ClaimsSection({
  presented,
  locale,
  labels,
}: {
  presented: PresentedClaim[];
  locale: "tr" | "en";
  labels: { heading: string; lapsedHeading: string; lapsedNote: string };
}) {
  const verified = presented.filter((p) => p.kind === "verified");
  const lapsed = presented.filter((p) => p.kind === "lapsed");
  if (presented.length === 0) return null;

  return (
    <section className="pb-24" aria-labelledby="claims-heading">
      {/* A real heading, not a <p> with aria-labelledby: screen-reader
          heading navigation is how people skim, and this is the page's most
          important section. */}
      <h2
        id="claims-heading"
        className="font-mono text-[11px] tracking-[0.22em] uppercase text-ink-300 mb-10"
      >
        {labels.heading}
      </h2>

      {verified.length > 0 ? (
        // role="list" because list-style:none strips list semantics in
        // Safari/VoiceOver, so "3 items" is never announced without it.
        <ul role="list" className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0 m-0">
          {verified.map((item) => (
            <ProofCard key={item.claim.id} presented={item} locale={locale} />
          ))}
        </ul>
      ) : null}

      {lapsed.length > 0 ? (
        <div className="mt-14">
          <h3
            id="lapsed-heading"
            className="font-mono text-[11px] tracking-[0.22em] uppercase text-amber-300/90"
          >
            {labels.lapsedHeading} ({lapsed.length})
          </h3>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.7] text-ink-300">
            {labels.lapsedNote}
          </p>
          <ul
            role="list"
            aria-labelledby="lapsed-heading"
            className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0 m-0"
          >
            {lapsed.map((item) => (
              <ProofCard key={item.claim.id} presented={item} locale={locale} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
