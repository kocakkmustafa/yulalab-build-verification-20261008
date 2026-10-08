import { describe, expect, it } from "vitest";
import { projects } from "@/data/projects";
import { publicRegistry } from "@/data/public-registry";

// Store URLs currently live in two places: ProjectConfig.links (drives the
// showcase page's external-link pills) and the registry's surfaces (the
// Y-P0-003 trust layer). Rewiring the showcase UI to read store URLs only
// from the registry is Y-P1-001's job (real UI components, not just data
// plumbing) — see EVIDENCE-LEDGER.md Y-P0-003 note for the scope reasoning.
// Until then, this test is what actually prevents the drift the roadmap's
// Y-P0-003 Run check (`rg apps.apple.com|play.google.com ...`) is checking
// for by hand: if a store URL changes in one place and not the other, this
// fails loudly instead of the two silently disagreeing.
describe("registry ↔ ProjectConfig store-URL sync", () => {
  it("every registry record has a matching ProjectConfig by slug", () => {
    const projectSlugs = new Set(projects.map((p) => p.slug));
    for (const record of publicRegistry) {
      expect(projectSlugs.has(record.slug), `registry has "${record.slug}" but projects/index.ts does not`).toBe(true);
    }
  });

  it("every ProjectConfig has a matching registry record by slug", () => {
    const registrySlugs = new Set(publicRegistry.map((r) => r.slug));
    for (const project of projects) {
      expect(registrySlugs.has(project.slug), `projects/index.ts has "${project.slug}" but the registry does not`).toBe(true);
    }
  });

  it("appstore links in ProjectConfig match an ios surface URL in the registry", () => {
    for (const project of projects) {
      const appstoreLink = project.links.find((l) => l.kind === "appstore" && l.href);
      if (!appstoreLink) continue;
      const record = publicRegistry.find((r) => r.slug === project.slug);
      const iosSurface = record?.surfaces.find((s) => s.kind === "ios");
      expect(
        iosSurface?.url,
        `${project.slug}: ProjectConfig.links appstore URL and registry ios surface URL disagree`,
      ).toBe(appstoreLink.href);
    }
  });

  it("playstore links in ProjectConfig match an android surface URL in the registry", () => {
    for (const project of projects) {
      const playstoreLink = project.links.find((l) => l.kind === "playstore" && l.href);
      if (!playstoreLink) continue;
      const record = publicRegistry.find((r) => r.slug === project.slug);
      const androidSurface = record?.surfaces.find((s) => s.kind === "android");
      expect(
        androidSurface?.url,
        `${project.slug}: ProjectConfig.links playstore URL and registry android surface URL disagree`,
      ).toBe(playstoreLink.href);
    }
  });
});
