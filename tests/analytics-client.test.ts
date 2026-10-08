import { describe, expect, it } from "vitest";
import {
  attributionEnabled,
  extractUtm,
  newSessionToken,
  buildEventBody,
} from "@/lib/analytics/client";
import { parseEventPayload } from "@/lib/analytics/events";

describe("session token", () => {
  it("mints a 32-char lowercase hex token the contract accepts", () => {
    const token = newSessionToken();
    expect(token).toMatch(/^[a-f0-9]{32}$/);
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newSessionToken()));
    expect(tokens.size).toBe(200);
  });

  // Where the token actually lives is asserted in tests/analytics-track.test.ts
  // against a real DOM. The version of this test that lived here checked only
  // that the key names were strings — it would have passed unchanged if
  // readSession() had used localStorage or a two-year cookie, which is to say
  // it tested nothing but its own title.
});

describe("UTM capture", () => {
  it("reads the four standard parameters", () => {
    const utm = extractUtm(
      new URLSearchParams("utm_source=links&utm_medium=referral&utm_campaign=launch-2026&utm_content=card_a"),
    );
    expect(utm).toEqual({
      source: "links",
      medium: "referral",
      campaign: "launch-2026",
      content: "card_a",
    });
  });

  it("drops values the event contract would reject rather than sending a doomed payload", () => {
    // A campaign carrying prose is more likely a mistake or an injection
    // than a real campaign; dropping it locally keeps a single bad inbound
    // link from silently zeroing out every event on the page.
    const utm = extractUtm(new URLSearchParams("utm_campaign=hello there friend&utm_source=links"));
    expect(utm.campaign).toBeUndefined();
    expect(utm.source).toBe("links");
  });

  it("returns an empty object when there are no parameters", () => {
    expect(extractUtm(new URLSearchParams(""))).toEqual({});
  });
});

describe("event body assembly", () => {
  it("produces a payload the server contract accepts", () => {
    const payload = buildEventBody({
      event: "store_outbound",
      locale: "tr",
      page: "/projects/lifeos",
      product: "lifeos",
      target: "https://apps.apple.com/tr/app/id123",
      targetCategory: "store",
      session: newSessionToken(),
      utm: { source: "links", medium: "referral" },
    });
    const result = parseEventPayload(payload);
    expect(result.ok, result.ok ? "" : result.reason).toBe(true);
  });

  it("strips a query string from the page path before sending", () => {
    const payload = buildEventBody({
      event: "product_view",
      locale: "en",
      page: "/projects/lifeos?utm_source=links#top",
      product: "lifeos",
      session: newSessionToken(),
      utm: {},
    });
    expect(payload.page).toBe("/projects/lifeos");
    expect(parseEventPayload(payload).ok).toBe(true);
  });

  it("omits undefined optional keys instead of sending explicit undefined", () => {
    const payload = buildEventBody({
      event: "product_view",
      locale: "tr",
      page: "/projects/lifeos",
      session: newSessionToken(),
      utm: {},
    });
    expect(Object.keys(payload)).not.toContain("target");
    expect(Object.keys(payload)).not.toContain("product");
    expect(parseEventPayload(payload).ok).toBe(true);
  });
});

describe("the attribution switch", () => {
  it("is off unless explicitly enabled", () => {
    // Fail-closed: no storage provisioned means no beacons fired, so the
    // site never makes a guaranteed-failing request on a visitor's click
    // and never implies it recorded something it did not.
    delete process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED;
    expect(attributionEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED = "0";
    expect(attributionEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED = "true";
    expect(attributionEnabled()).toBe(false);
  });

  it("turns on for exactly one value", () => {
    process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED = "1";
    expect(attributionEnabled()).toBe(true);
    delete process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED;
  });
});

describe("target categorisation", () => {
  it("files store links as store, not as web", async () => {
    const { categoriseTarget } = await import("@/lib/analytics/client");
    expect(categoriseTarget("https://apps.apple.com/app/id6771527233")).toBe("store");
    expect(categoriseTarget("https://play.google.com/store/apps/details?id=x")).toBe("store");
  });

  it("files first-party links as internal and everything else as web", async () => {
    const { categoriseTarget } = await import("@/lib/analytics/client");
    expect(categoriseTarget("https://links.yulalab.com/")).toBe("internal");
    expect(categoriseTarget("https://braavolabs.com")).toBe("web");
    expect(categoriseTarget("not a url")).toBe("web");
  });
});
