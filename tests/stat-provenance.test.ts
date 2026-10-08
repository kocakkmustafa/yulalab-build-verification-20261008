import { describe, expect, it } from "vitest";
import { projects } from "@/data/projects";
import { publicRegistry } from "@/data/public-registry";
import { linkedClaimFor, unsourcedQuantitativeStats } from "@/lib/stat-provenance";

/**
 * A stat card is the biggest number on a product page. Roadmap §1.4: every
 * quantitative claim shows source, scope, date and expiry.
 *
 * The failure this file guards is sharper than "some numbers lack sources".
 * It is the SAME number appearing twice — once in a claim card carrying full
 * provenance and a freshness marker, and once directly above it as a giant
 * unmarked figure. When the claim lapses, the marked copy is flagged and the
 * unmarked copy keeps asserting it as current, which makes the whole
 * freshness mechanism decorative on the surface people actually read.
 */
/**
 * A stat's figure must be one the claim DECLARES, compared as structured
 * data rather than recovered from the sentence.
 *
 * Prose matching could not tell an asserted figure from a disclaimed one.
 * The Burun Farkı claim contains "~69%" precisely to warn readers that the
 * training-time backtest is a different measurement — and the regex read it
 * as a warrant, so promoting Top-3 to ~%69 passed the honesty guard. That is
 * the exact figure Y-P0-001 existed to correct. The Braavolabs
 * combination-space claim likewise accepted "50", a config constant sitting
 * inside a limitation caveat.
 *
 * Comparing against claim.figures also retires the spelled-out exception
 * list entirely — the mechanism that carried the previous two blockers.
 * "Nine primitives" needs no exception when the claim simply declares ["9"].
 */
function normalise(figure: string): string {
  return figure.trim().toLocaleLowerCase("en");
}

function claimAsserts(claim: { figures?: string[] }, value: string): boolean {
  return (claim.figures ?? []).some((f) => normalise(f) === normalise(value));
}

describe("stats that restate a registry claim must be linked to it", () => {
  it("every claimId on a stat resolves to a real claim", () => {
    for (const project of projects) {
      for (const stat of project.stats ?? []) {
        if (!stat.claimId) continue;
        const record = publicRegistry.find((r) => r.slug === project.slug);
        expect(record, `${project.slug} has a stat claimId but no registry record`).toBeTruthy();
        expect(
          record!.claims.some((c) => c.id === stat.claimId),
          `${project.slug}: stat claimId "${stat.claimId}" matches no claim`,
        ).toBe(true);
      }
    }
  });

  it("resolves a linked stat back to its claim", () => {
    const bf = projects.find((p) => p.slug === "burunfarki")!;
    const stat = bf.stats.find((s) => s.value === "~%62")!;
    expect(linkedClaimFor("burunfarki", stat)?.id).toBe("burunfarki-topk-accuracy");
  });

  it("links exactly the stats that are supposed to be linked", () => {
    // Keyed on the LABEL as well as the value. Every other guard reasons
    // about stat.value, so swapping the label objects on Top-1 and Top-3
    // shipped "Top-3 ~%29 / Top-1 ~%62" — the headline metric doubled and
    // stamped as verified — with no test edit anywhere. A bare number means
    // nothing without its label; the pair is the claim.
    const EXPECTED = [
      ["braavolabs", "Primitives", "9", "braavolabs-primitive-count"],
      ["braavolabs", "LLM Providers", "14", "braavolabs-provider-count"],
      ["burunfarki", "Top-1 (live tracking)", "~%29", "burunfarki-topk-accuracy"],
      ["burunfarki", "Top-3 (live tracking)", "~%62", "burunfarki-topk-accuracy"],
      ["burunfarki", "live-tracked races", "1.225", "burunfarki-topk-accuracy"],
      ["lifeos", "On-device encryption", "AES-256", "lifeos-on-device-encryption"],
    ] as const;

    const actual = projects
      .flatMap((p) => (p.stats ?? []).map((s) => [p.slug, s.label.en, s.value, s.claimId] as const))
      .filter((t): t is readonly [string, string, string, string] => Boolean(t[3]))
      .map(([slug, label, value, id]) => `${slug}|${label}|${value}|${id}`)
      .sort();

    expect(actual).toEqual(EXPECTED.map(([s, l, v, i]) => `${s}|${l}|${v}|${i}`).sort());
  });
});

describe("a linked stat must be a figure its claim declares", () => {
  it("declares figures on every claim a stat links to", () => {
    for (const project of projects) {
      const record = publicRegistry.find((r) => r.slug === project.slug);
      for (const stat of project.stats ?? []) {
        if (!stat.claimId) continue;
        const claim = record?.claims.find((c) => c.id === stat.claimId);
        expect(
          claim?.figures?.length,
          `${stat.claimId} is linked from a stat but declares no figures`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("finds every linked figure among the ones its claim declares", () => {
    const mismatches: string[] = [];
    for (const project of projects) {
      const record = publicRegistry.find((r) => r.slug === project.slug);
      for (const stat of project.stats ?? []) {
        if (!stat.claimId) continue;
        const claim = record?.claims.find((c) => c.id === stat.claimId);
        if (!claim) continue;
        if (!claimAsserts(claim, stat.value)) {
          mismatches.push(
            `${project.slug}: stat "${stat.value}" claims provenance from ${stat.claimId}, which declares [${(claim.figures ?? []).join(", ")}]`,
          );
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("refuses a figure the claim only mentions in order to disclaim it", () => {
    // The failure mode a prose matcher had no case for: PRESENT but not
    // asserted. ~69% appears in the Burun Farkı statement solely to mark the
    // training-time backtest as a different measurement.
    const bf = publicRegistry.find((r) => r.slug === "burunfarki")!;
    const claim = bf.claims.find((c) => c.id === "burunfarki-topk-accuracy")!;
    expect(claim.statementEn).toContain("69");
    expect(claimAsserts(claim, "~%69")).toBe(false);
    expect(claimAsserts(claim, "~%62")).toBe(true);
  });

  it("refuses a config constant buried in a limitation caveat", () => {
    const br = publicRegistry.find((r) => r.slug === "braavolabs")!;
    const claim = br.claims.find((c) => c.id === "braavolabs-combination-space")!;
    expect(claimAsserts(claim, "50")).toBe(false);
  });

  it("cannot declare a figure the statement does not contain", () => {
    // Moving figures into structured data fixed "a disclaimer is not a
    // warrant", but opened the opposite hole: nothing tied figures back to
    // the sentence, so `figures: ["~%99"]` beside a statement saying ~62%
    // would have passed. The pairing is deliberately asymmetric —
    // containment is NECESSARY (a figure cannot be invented) but not
    // SUFFICIENT (being present is exactly what ~69% already was).
    //
    // Spelled-out numerals are handled by a DECLARED word form, never by
    // sniffing the prose. The sniff version used `on\b` with no leading
    // boundary, so "The on-device database…" matched and exempted the LifeOS
    // encryption claim wholesale — `figures: ["AES-512"]` then passed while
    // the statement said AES-256.
    const missing: string[] = [];
    for (const record of publicRegistry) {
      for (const claim of record.claims) {
        for (const figure of claim.figures ?? []) {
          const word = claim.figureWords?.[figure];
          if (word) {
            // Justified by the word form actually being there.
            if (!claim.statementTr.includes(word.tr) || !claim.statementEn.includes(word.en)) {
              missing.push(
                `${record.slug}/${claim.id}: declares "${figure}" as spelled out (${word.tr}/${word.en}) but the statements do not contain those words`,
              );
            }
            continue;
          }
          const digits = figure.replace(/[^0-9]/g, "");
          if (digits.length === 0) continue;
          // Same normalisation as the round-4 fix: ISO dates removed, because
          // every claim carries one and "19" matches inside "2026-08-19".
          const searchable = (text: string) =>
            text.replace(/\d{4}-\d{2}-\d{2}/g, " ").replace(/[.,\u00a0]/g, "");
          const boundary = new RegExp(`(?<![0-9])${digits}(?![0-9])`);
          if (
            !boundary.test(searchable(claim.statementTr)) &&
            !boundary.test(searchable(claim.statementEn))
          ) {
            missing.push(
              `${record.slug}/${claim.id}: declares figure "${figure}" but neither statement contains it`,
            );
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("does not let a date in the statement justify a figure", () => {
    // Regression guard for the round-4 fix that the containment check
    // dropped: figures ["14","19"] passed via "2026-08-19".
    const searchable = (text: string) =>
      text.replace(/\d{4}-\d{2}-\d{2}/g, " ").replace(/[.,\u00a0]/g, "");
    const br = publicRegistry.find((r) => r.slug === "braavolabs")!;
    const claim = br.claims.find((c) => c.id === "braavolabs-provider-count")!;
    expect(claim.statementEn).toMatch(/2026-08-19/);
    expect(/(?<![0-9])19(?![0-9])/.test(searchable(claim.statementEn))).toBe(false);
  });

  it("the matcher itself behaves", () => {
    expect(claimAsserts({ figures: ["~%62"] }, "~%62")).toBe(true);
    expect(claimAsserts({ figures: ["~%62"] }, "~%69")).toBe(false);
    expect(claimAsserts({ figures: [] }, "9")).toBe(false);
    expect(claimAsserts({}, "9")).toBe(false);
  });
});

describe("the remaining unsourced numbers are counted, not hidden", () => {
  it("reports them as a known set rather than letting the number drift upward", () => {
    // Not asserted to be zero: several of these are structural product facts
    // ("5 life domains", "0 ads") rather than measurements, and inventing
    // sources for them would be worse than saying so. What this pins is the
    // SIZE of the gap, so it cannot quietly grow.
    const unsourced = unsourcedQuantitativeStats(projects, publicRegistry);
    expect(unsourced.length).toBeLessThanOrEqual(11);
  });

  it("does not count a linked stat as unsourced", () => {
    const unsourced = unsourcedQuantitativeStats(projects, publicRegistry);
    expect(unsourced.some((u) => u.value === "~%62")).toBe(false);
  });
});
