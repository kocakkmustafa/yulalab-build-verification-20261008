import { describe, expect, it } from "vitest";
import { projects } from "@/data/projects";
import tr from "../messages/tr.json";
import en from "../messages/en.json";

/**
 * A CTA that promises one destination and delivers another is the same
 * class of defect as a stale metric: the visible surface says something the
 * system does not do. It was also real — LifeOS's "Open in the App Store"
 * button pointed at its legal microsite on production until 2026-08-19.
 *
 * These tests anchor on BEHAVIOUR (which host the button actually reaches)
 * rather than on the exact wording, so rephrasing the copy does not trip
 * them, but re-pointing the link does.
 */
type Messages = { product: Record<string, { ctaPrimary?: string } | undefined> };

function ctaDestination(slug: string): string | null {
  const project = projects.find((p) => p.slug === slug);
  if (!project) return null;
  const kind = project.primaryCtaKind ?? "web";
  return project.links.find((l) => l.kind === kind)?.href ?? null;
}

describe("primary CTA promises match where the button goes", () => {
  it.each(projects.map((p) => p.slug))("%s", (slug) => {
    const labels = [
      (tr as unknown as Messages).product[slug]?.ctaPrimary ?? "",
      (en as unknown as Messages).product[slug]?.ctaPrimary ?? "",
    ];
    const href = ctaDestination(slug);

    for (const label of labels) {
      const promisesAppStore = /app\s*store/i.test(label);
      const promisesPlayStore = /google\s*play|play\s*store/i.test(label);

      if (promisesAppStore) {
        expect(href, `${slug}: "${label}" must reach Apple`).toBeTruthy();
        expect(new URL(href as string).host).toBe("apps.apple.com");
      }
      if (promisesPlayStore) {
        expect(href, `${slug}: "${label}" must reach Google Play`).toBeTruthy();
        expect(new URL(href as string).host).toBe("play.google.com");
      }
    }
  });

  it("never renders a CTA whose destination is missing", () => {
    // A product with no destination must render no button at all rather
    // than a dead one — ProductPage already guards this, and this test
    // keeps the data side honest about which products have somewhere to go.
    for (const project of projects) {
      const kind = project.primaryCtaKind ?? "web";
      const link = project.links.find((l) => l.kind === kind);
      if (project.primaryCtaKind) {
        expect(link?.href, `${project.slug} names a CTA kind that has no URL`).toBeTruthy();
      }
    }
  });
});
