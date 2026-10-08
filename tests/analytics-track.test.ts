// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_STORAGE_KEY, UTM_STORAGE_KEY, rememberUtm, track } from "@/lib/analytics/client";

/**
 * Real DOM coverage for the browser half.
 *
 * The suite previously ran only in the node environment, where `window` is
 * undefined and track() returns on its first line — so the session store,
 * the UTM carry-over and the "never blocks" contract were asserted nowhere
 * but in comments. The old storage test asserted
 * `expect(SESSION_STORAGE_KEY).toBeTypeOf("string")`, which would have
 * passed unchanged had readSession() used localStorage or a two-year cookie.
 */
const beacons: Array<{ url: string; body: unknown }> = [];

/** sendBeacon receives a Blob; read it back as the JSON that was sent. */
async function payloadOf(index: number): Promise<Record<string, unknown>> {
  const body = beacons[index].body;
  const text = body instanceof Blob ? await body.text() : String(body);
  return JSON.parse(text) as Record<string, unknown>;
}

beforeEach(() => {
  beacons.length = 0;
  window.sessionStorage.clear();
  window.localStorage.clear();
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, body: unknown) => {
      beacons.push({ url, body });
      return true;
    },
  });
  process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED = "1";
  window.history.replaceState({}, "", "/tr/projects/lifeos");
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED;
});

describe("track()", () => {
  it("sends one beacon and returns synchronously", () => {
    const result = track({ event: "product_view", product: "lifeos" });
    expect(result).toBeUndefined();
    expect(beacons).toHaveLength(1);
    expect(beacons[0].url).toBe("/api/events");
  });

  it("mints the session token in sessionStorage and NOT in localStorage", () => {
    track({ event: "product_view", product: "lifeos" });
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toMatch(/^[a-f0-9]{32}$/);
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("reuses one token across events so a session is groupable", async () => {
    track({ event: "product_view", product: "lifeos" });
    track({ event: "product_primary_cta", product: "lifeos" });
    const [first, second] = await Promise.all([payloadOf(0), payloadOf(1)]);
    expect(first.session).toBe(second.session);
  });

  it("emits nothing at all when attribution is disabled", () => {
    delete process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED;
    track({ event: "product_view", product: "lifeos" });
    expect(beacons).toHaveLength(0);
    // Not even an identifier is created — "off" means off, not "sent and dropped".
    expect(window.sessionStorage.length).toBe(0);
  });

  it("never throws when sendBeacon is hostile", () => {
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: () => {
        throw new Error("beacon exploded");
      },
    });
    // A funnel that can throw is a funnel that can break a visitor's click.
    expect(() => track({ event: "product_view", product: "lifeos" })).not.toThrow();
  });

  it("never throws when storage itself is hostile", () => {
    // Safari in Lockdown/private mode throws on sessionStorage access rather
    // than returning null. The previous version of this test claimed to
    // cover "storage and sendBeacon" but only ever broke the beacon.
    const throwing = {
      getItem() {
        throw new Error("storage blocked");
      },
      setItem() {
        throw new Error("storage blocked");
      },
      get length(): number {
        throw new Error("storage blocked");
      },
    };
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: throwing });
    expect(() => track({ event: "product_view", product: "lifeos" })).not.toThrow();
    // Still reports: a visitor with storage disabled is ungrouped, not invisible.
    expect(beacons).toHaveLength(1);
    if (original) Object.defineProperty(window, "sessionStorage", original);
  });

  it("carries UTM from the landing URL through later events", async () => {
    window.history.replaceState({}, "", "/tr?utm_source=links&utm_campaign=launch-2026");
    rememberUtm();
    window.history.replaceState({}, "", "/tr/projects/lifeos");
    track({ event: "product_view", product: "lifeos" });
    const payload = await payloadOf(0);
    expect(payload.source).toBe("links");
    expect(payload.campaign).toBe("launch-2026");
    expect(window.sessionStorage.getItem(UTM_STORAGE_KEY)).toContain("links");
  });

  it("sends the path only, never the query string", async () => {
    window.history.replaceState({}, "", "/tr/contact?email=someone@example.com");
    track({ event: "product_view", product: "lifeos" });
    const payload = await payloadOf(0);
    expect(payload.page).toBe("/tr/contact");
    expect(JSON.stringify(payload)).not.toContain("someone@example.com");
  });

  it("falls back to keepalive fetch when sendBeacon is absent", () => {
    Object.defineProperty(window.navigator, "sendBeacon", { configurable: true, value: undefined });
    const fetchSpy = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 202 })),
    );
    vi.stubGlobal("fetch", fetchSpy);
    track({ event: "product_view", product: "lifeos" });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/events");
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: "POST", keepalive: true });
    vi.unstubAllGlobals();
  });
});
