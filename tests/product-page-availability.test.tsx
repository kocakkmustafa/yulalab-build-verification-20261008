// @vitest-environment jsdom
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ProductPage } from "@/components/projects/ProductPage";
import { lifeos } from "@/data/projects/lifeos";
import { burunfarki } from "@/data/projects/burunfarki";
import { publicRegistry } from "@/data/public-registry";
import tr from "../messages/tr.json";
import en from "../messages/en.json";

vi.mock("@/i18n/navigation", () => ({
  Link: (props: ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("@/components/common/Reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/common/TrackView", () => ({ TrackView: () => null }));
vi.mock("@/components/common/GlassSheen", () => ({ GlassSheen: () => null }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(["tr", "en"] as const)("%s product publication status", (locale) => {
  const messages = locale === "tr" ? tr : en;
  const surface = publicRegistry.find((record) => record.slug === "lifeos")!
    .surfaces.find((candidate) => candidate.kind === "ios")!;

  function renderAt(instant: Date) {
    vi.useFakeTimers();
    vi.setSystemTime(instant);
    render(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Istanbul">
        <ProductPage project={lifeos} />
      </NextIntlClientProvider>,
    );
  }

  it("keeps the confirmed publication title through the expiry day", () => {
    renderAt(new Date(`${surface.expiresAt}T23:59:59+03:00`));
    expect(screen.getByRole("heading", { name: messages.product.lifeos.ctaTitle })).toBeTruthy();
  });

  it("withdraws the live assertion after expiry while retaining the store link", () => {
    renderAt(new Date(new Date(`${surface.expiresAt}T23:59:59+03:00`).getTime() + 1000));
    expect(screen.queryByRole("heading", { name: messages.product.lifeos.ctaTitle })).toBeNull();
    expect(screen.getByRole("heading", { name: locale === "tr" ? "Yayın durumu yeniden doğrulanmalı" : "Publication status needs re-verification" })).toBeTruthy();
    expect(screen.getByRole("link", { name: messages.product.lifeos.ctaPrimary }).getAttribute("href")).toBe(surface.url);
    expect(screen.getByText(messages.product.availabilityCheckedAt.replace("{date}", surface.verifiedAt))).toBeTruthy();
  });

  it.each(["unavailable", "coming-soon"] as const)("does not assert availability for a freshly checked %s surface", (status) => {
    vi.spyOn(surface, "status", "get").mockReturnValue(status);
    renderAt(new Date(`${surface.verifiedAt}T12:00:00+03:00`));
    expect(screen.queryByRole("heading", { name: messages.product.lifeos.ctaTitle })).toBeNull();
    expect(screen.getByRole("heading", { name: messages.product.availabilityUnverified })).toBeTruthy();
  });

  it("does not keep an undated platform-open assertion below the expired BF title", () => {
    const web = publicRegistry.find((r) => r.slug === "burunfarki")!.surfaces.find((s) => s.kind === "web")!;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(new Date(`${web.expiresAt}T23:59:59+03:00`).getTime() + 1000));
    render(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Istanbul">
        <ProductPage project={burunfarki} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { name: messages.product.availabilityUnverified })).toBeTruthy();
    expect(screen.queryByText(/platform açık|platform is open/i)).toBeNull();
    expect(screen.getByRole("link", { name: messages.product.burunfarki.ctaPrimary }).getAttribute("href")).toBe(web.url);
  });
});
