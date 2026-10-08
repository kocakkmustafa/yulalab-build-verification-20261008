import { describe, expect, it } from "vitest";
import { projects } from "@/data/projects";
import { publicRegistry } from "@/data/public-registry";

/**
 * Roadmap §1.4: no fabricated product screens, and a product without real UI
 * carries an explicit concept/research label.
 *
 * The site already honours this — the five Motion products render an empty
 * interface section reading "we don't draw a screen that doesn't exist" —
 * but nothing PREVENTED a research product from gaining a screenshot. A rule
 * that holds by current practice rather than by construction is one edit
 * from not holding, and the edit that breaks it (adding a nice-looking
 * mockup to an unreleased product) is exactly the tempting one.
 */
type Shot = { kind?: string; src?: string };
type Visuals = { screenshots?: Shot[] };
type Config = { slug: string; status: string; visuals?: Visuals };

const configs = projects as unknown as Config[];

function productShots(config: Config): Shot[] {
  return (config.visuals?.screenshots ?? []).filter((s) => s.kind === "product");
}

describe("only a shipped product may show a product screenshot", () => {
  it.each(configs.map((c) => [c.slug, c.status] as const))(
    "%s (%s)",
    (slug, status) => {
      const config = configs.find((c) => c.slug === slug)!;
      const shots = productShots(config);
      const shipped = status === "live" || status === "beta";
      if (!shipped) {
        expect(
          shots,
          `${slug} is "${status}" but carries ${shots.length} product screenshot(s) — an unreleased product must not show a UI it does not have`,
        ).toHaveLength(0);
      }
    },
  );

  it("names which products are allowed to have one, so a status flip is deliberate", () => {
    const allowed = configs.filter((c) => c.status === "live" || c.status === "beta").map((c) => c.slug).sort();
    expect(allowed).toEqual(["braavolabs", "burunfarki", "lifeos"]);
  });
});

describe("the registry agrees with what the page can render", () => {
  it("declares no screenshots for a research product", () => {
    for (const record of publicRegistry) {
      if (record.lifecycle !== "research") continue;
      expect(
        record.screenshots,
        `${record.slug} is research but the registry declares screenshots`,
      ).toHaveLength(0);
    }
  });

  it("gives every declared screenshot a build and a capture date", () => {
    // Already enforced by validateRecord for live/beta; asserted here too so
    // the reason survives next to the honesty rule it serves — a screenshot
    // with no provenance is a picture, not evidence.
    for (const record of publicRegistry) {
      for (const shot of record.screenshots) {
        expect(shot.sourceBuild, `${record.slug}: screenshot ${shot.path} has no sourceBuild`).toBeTruthy();
        expect(shot.capturedAt, `${record.slug}: screenshot ${shot.path} has no capturedAt`).toBeTruthy();
      }
    }
  });
});
