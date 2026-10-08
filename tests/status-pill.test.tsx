// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { StatusPill } from "@/components/common/StatusPill";
import { publicRegistry } from "@/data/public-registry";
import type { ProjectStatus } from "@/lib/types";
import en from "../messages/en.json";
import tr from "../messages/tr.json";

vi.mock("@/data/public-registry", async (original) => {
  const actual = await original<typeof import("@/data/public-registry")>();
  const template = actual.publicRegistry.find(r => r.slug === "lifeos")!;
  const surface = template.surfaces[0];
  return { publicRegistry: [...actual.publicRegistry,
    { ...template, slug: "beta-only", surfaces: [{ ...surface, status: "beta", expiresAt: "2026-10-06" }] },
    { ...template, slug: "unavailable", surfaces: [{ ...surface, status: "coming-soon", expiresAt: "2026-10-06" }] },
  ] };
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

function show(slug: string, status: ProjectStatus, now: Date, locale: "tr" | "en" = "en") {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : tr} timeZone="Europe/Istanbul">
      <StatusPill slug={slug} status={status} />
    </NextIntlClientProvider>,
  );
}

describe("publication status on portfolio cards", () => {
  for (const [slug, status] of [["lifeos", "live"], ["burunfarki", "live"], ["braavolabs", "beta"]] as const) {
    const record = publicRegistry.find(r => r.slug === slug)!;
    const expiry = record.surfaces.map(s => s.expiresAt!).sort().at(-1)!;
    const lastDay = new Date(`${expiry}T12:00:00+03:00`);

    it(`${slug} retains its status on the last verified day`, () => {
      show(slug, status, lastDay);
      expect(screen.getByText(en.status[status])).toBeTruthy();
      expect(screen.queryByText(en.product.availabilityUnverified)).toBeNull();
    });

    it(`${slug} qualifies availability the next day`, () => {
      show(slug, status, new Date(lastDay.getTime() + 86_400_000));
      expect(screen.getByText(en.product.availabilityUnverified)).toBeTruthy();
      expect(screen.queryByText(en.status[status])).toBeNull();
    });
  }

  it("does not infer publication without a registry record", () => {
    show("missing", "live", new Date("2026-10-06T12:00:00Z"));
    expect(screen.getByText(en.product.availabilityUnverified)).toBeTruthy();
  });

  it("does not upgrade a current beta surface to live", () => {
    show("beta-only", "live", new Date("2026-10-06T12:00:00Z"));
    expect(screen.getByText(en.product.availabilityUnverified)).toBeTruthy();
    expect(screen.queryByText(en.status.live)).toBeNull();
  });

  it("accepts a current beta surface for a beta card", () => {
    show("beta-only", "beta", new Date("2026-10-06T12:00:00Z"));
    expect(screen.getByText(en.status.beta)).toBeTruthy();
    expect(screen.queryByText(en.product.availabilityUnverified)).toBeNull();
  });

  it("does not assert availability just because an inactive status is fresh", () => {
    show("unavailable", "live", new Date("2026-10-06T12:00:00Z"));
    expect(screen.getByText(en.product.availabilityUnverified)).toBeTruthy();
  });

  it("keeps a research card labelled as research", () => {
    show("jablab", "coming-soon", new Date("2026-10-06T12:00:00Z"));
    expect(screen.getByText(en.status.comingSoon)).toBeTruthy();
    expect(screen.queryByText(en.product.availabilityUnverified)).toBeNull();
  });

  it("qualifies availability in Turkish too", () => {
    show("lifeos", "live", new Date("2026-10-06T12:00:00Z"), "tr");
    expect(screen.getByText(tr.product.availabilityUnverified)).toBeTruthy();
  });
});
