import { describe, it, expect } from "vitest";
import {
  EVIDENCE_LEVELS,
  forbiddenPatternCount,
  evidenceCounts,
  lapsedSurfaceCount,
  lifecycleRows,
  portfolioCounts,
} from "@/lib/operating-system";
import { publicRegistry } from "@/data/public-registry";
import type { EvidenceKind } from "@/lib/types";

/**
 * The Operating System page describes how this site stays honest, which
 * makes it the page least allowed to drift. These tests anchor its numbers
 * to BEHAVIOUR (recomputation from the registry), not to today's values —
 * a test asserting "6 claims" would have to be edited every time a claim is
 * added, and an assertion people routinely edit protects nothing.
 */
describe("operating-system figures", () => {
  it("counts every claim in the registry exactly once across the evidence levels", () => {
    const counts = evidenceCounts();
    const summed = Object.values(counts).reduce((a, b) => a + b, 0);
    const actual = publicRegistry.reduce((n, r) => n + r.claims.length, 0);
    expect(summed).toBe(actual);
  });

  it("declares each evidenceKind exactly once, exhaustively", () => {
    /**
     * Checked against the TYPE's full set, not against the kinds the
     * registry happens to hold today. Iterating the registry made this
     * vacuous for precisely the two kinds the page makes claims about
     * (self-reported and third-party-verified are both empty), and a
     * mutation pointing K0 at "measured" — leaving one kind undeclared and
     * another double-counted — left the whole suite green.
     */
    const allKinds: EvidenceKind[] = [
      "self-reported",
      "source-code-verified",
      "measured",
      "third-party-verified",
    ];
    const declared = EVIDENCE_LEVELS.map((l) => l.kind);
    expect([...declared].sort()).toEqual([...allKinds].sort());
    expect(new Set(declared).size, "a kind is declared twice").toBe(declared.length);
    for (const record of publicRegistry) {
      for (const claim of record.claims) {
        expect(allKinds).toContain(claim.evidenceKind);
      }
    }
  });

  it("counts each level against its OWN kind", () => {
    // Guards the mislabel directly: every level's rendered count must equal
    // the number of claims actually carrying that kind.
    const counts = evidenceCounts();
    for (const level of EVIDENCE_LEVELS) {
      const actual = publicRegistry.reduce(
        (n, r) => n + r.claims.filter((c) => c.evidenceKind === level.kind).length,
        0,
      );
      expect(counts[level.kind], `${level.level} miscounts ${level.kind}`).toBe(actual);
    }
  });

  it("states the prose-scanner pattern count from the scanner's own array", async () => {
    /**
     * Anchored to the ARRAY the scanner actually iterates, not to a re-parse
     * of its source text. The previous version re-implemented the same
     * parsing and asserted the two agreed — which cannot catch a wrong
     * parser, proven live: a real 13th pattern at a different indentation
     * left the scanner at 13, the page printing 12, and the suite green.
     */
    const mod = await import("../scripts/forbidden-patterns.mjs");
    expect(forbiddenPatternCount(mod.FORBIDDEN)).toBe(mod.FORBIDDEN.length);
    expect(mod.FORBIDDEN.length).toBeGreaterThan(0);
    for (const entry of mod.FORBIDDEN) {
      // Each entry must actually be a usable pattern — a count of malformed
      // entries would still "agree" with itself.
      expect(entry.pattern instanceof RegExp).toBe(true);
    }
  });

  it("covers every lifecycle state in the registry, with counts that add up", () => {
    const rows = lifecycleRows();
    const declared = new Set(rows.map((r) => r.key));
    for (const record of publicRegistry) {
      expect(declared).toContain(record.lifecycle);
    }
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(publicRegistry.length);
  });

  it("gives every lifecycle state a stated mechanical effect in both languages", () => {
    for (const row of lifecycleRows()) {
      expect(row.effectTr.trim().length, `${row.key} has no TR effect`).toBeGreaterThan(0);
      expect(row.effectEn.trim().length, `${row.key} has no EN effect`).toBeGreaterThan(0);
    }
  });

  it("reports lapsed surfaces from the clock, not from a frozen number", () => {
    // Same window, two different 'now's must be able to disagree — that is
    // the whole point of deriving the figure the limitations section prints.
    const longAgo = lapsedSurfaceCount(new Date("2000-01-01T00:00:00+03:00"));
    const farFuture = lapsedSurfaceCount(new Date("2099-01-01T00:00:00+03:00"));
    const datedSurfaces = publicRegistry.reduce(
      (n, r) => n + r.surfaces.filter((s) => s.expiresAt).length,
      0,
    );
    expect(longAgo).toBe(0);
    expect(farFuture).toBe(datedSurfaces);
  });

  it("keeps portfolio totals in step with the registry", () => {
    const t = portfolioCounts();
    expect(t.products).toBe(publicRegistry.length);
    expect(t.claims).toBe(publicRegistry.reduce((n, r) => n + r.claims.length, 0));
    expect(t.surfaces).toBe(publicRegistry.reduce((n, r) => n + r.surfaces.length, 0));
    expect(t.screenshots).toBe(publicRegistry.reduce((n, r) => n + r.screenshots.length, 0));
  });
});
