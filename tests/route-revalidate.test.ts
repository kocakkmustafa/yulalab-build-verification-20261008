import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * The product route MUST revalidate.
 *
 * It did not, and the consequence was the worst kind: expiry had been taken
 * out of the BUILD gate specifically because runtime was supposed to catch
 * it, so when the route turned out to be a pure build-time prerender,
 * NEITHER gate caught an expired claim. The site would publish a stale
 * figure under "Verified claims" until someone happened to deploy.
 *
 * `revalidate` is a static export that Next reads by parsing the module, so
 * reading it the same way is testing the real thing rather than a proxy for
 * it. The second test observes the actual build output when one exists,
 * which is the only place the effect is directly visible.
 */
const root = path.resolve(import.meta.dirname, "..");
const ROUTE = "src/app/[locale]/projects/[slug]/page.tsx";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("product detail route rendering mode", () => {
  it("declares a bounded revalidate window", () => {
    // Comments stripped FIRST. Without this, `// export const revalidate =
    // 900;` satisfied the guard — and commenting a line out to "check
    // something quickly" is exactly how this regresses, far more likely than
    // deleting it. Deleting was caught; commenting was not.
    const source = stripComments(readFileSync(path.resolve(root, ROUTE), "utf8"));
    const match = source.match(/export const revalidate\s*=\s*(\d+)/);
    const forceDynamic = /export const dynamic\s*=\s*["']force-dynamic["']/.test(source);

    if (forceDynamic) return; // also correct, at a per-request cost

    expect(
      match,
      "product pages render claim freshness; without `revalidate` (or force-dynamic) that is evaluated once at build and an expired claim stays published until the next deploy",
    ).toBeTruthy();
    const seconds = Number(match?.[1]);
    expect(seconds).toBeGreaterThan(0);
    // A day-long window would technically satisfy "revalidates" while
    // leaving a lapsed claim published for most of a day.
    expect(seconds, "window too long to bound a lapsed claim usefully").toBeLessThanOrEqual(3600);
  });

  it("is reflected in the build output when a build is present", () => {
    // Skipped rather than failed when there is no build: `pnpm test` runs
    // without one in CI's ordering. The source assertion above always runs,
    // so this is an extra observation, never the only guard.
    const manifest = path.resolve(root, ".next/prerender-manifest.json");
    if (!existsSync(manifest)) {
      expect(true).toBe(true);
      return;
    }
    const data = JSON.parse(readFileSync(manifest, "utf8")) as {
      routes?: Record<string, { initialRevalidateSeconds?: number | false }>;
    };
    const productRoutes = Object.entries(data.routes ?? {}).filter(([k]) =>
      /^\/(tr|en)?\/?projects\/[a-z0-9-]+$/.test(k),
    );
    if (productRoutes.length === 0) {
      expect(true).toBe(true);
      return;
    }
    for (const [route, cfg] of productRoutes) {
      expect(
        cfg.initialRevalidateSeconds,
        `${route} was prerendered with no revalidation — freshness runs once, at build`,
      ).not.toBe(false);
    }
  });
});

describe("the guard itself", () => {
  it("is not satisfied by a commented-out declaration", () => {
    // Guarding the guard: this is the mutation that previously passed.
    const commented = stripComments(`
      // export const revalidate = 900;
      /* export const revalidate = 900; */
      export default function Page() { return null; }
    `);
    expect(/export const revalidate\s*=\s*(\d+)/.test(commented)).toBe(false);
  });

  it("still sees a real declaration next to comments", () => {
    const real = stripComments(`
      // revalidate is set below because the route is prerendered
      export const revalidate = 900;
    `);
    expect(real.match(/export const revalidate\s*=\s*(\d+)/)?.[1]).toBe("900");
  });
});
