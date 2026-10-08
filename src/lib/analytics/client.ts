import { categoryForHost } from "./events";
import type { EventName, EventLocale, TargetCategory } from "./events";

/**
 * Browser-side half of the attribution chain.
 *
 * Design constraint that shapes everything here: an outbound click is a
 * navigation. The page is about to be torn down, so the event must be
 * handed to the browser in a way that survives unload (sendBeacon), and
 * nothing may ever delay or cancel the navigation itself. A funnel that
 * costs the visitor a click is worse than no funnel.
 */

/** Tab-scoped, so the client-side identifier dies when the tab does. */
export const SESSION_STORAGE_KEY = "yula.session";
export const UTM_STORAGE_KEY = "yula.utm";

export type Utm = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
};

/** Mirrors the server's UTM rule, so we never send a payload we know is invalid. */
const UTM_PATTERN = /^[A-Za-z0-9_\-.]{1,64}$/;

export function newSessionToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function extractUtm(params: URLSearchParams): Utm {
  const utm: Utm = {};
  const map = [
    ["utm_source", "source"],
    ["utm_medium", "medium"],
    ["utm_campaign", "campaign"],
    ["utm_content", "content"],
  ] as const;
  for (const [param, key] of map) {
    const value = params.get(param);
    // A value the server would reject is dropped here rather than sent.
    // Otherwise one malformed inbound link would 400 every event on the
    // landing page, and the funnel would look broken instead of the link.
    if (value && UTM_PATTERN.test(value)) utm[key] = value;
  }
  return utm;
}

export type BuildEventInput = {
  event: EventName;
  locale: EventLocale;
  page: string;
  product?: string;
  target?: string;
  targetCategory?: TargetCategory;
  session: string;
  utm: Utm;
};

/** Strips query/fragment: the server rejects them, and they are where PII leaks. */
function pathOnly(page: string): string {
  return page.split("#")[0].split("?")[0] || "/";
}

export function buildEventBody(input: BuildEventInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    v: 1,
    event: input.event,
    locale: input.locale,
    page: pathOnly(input.page),
    session: input.session,
  };
  // Keys are added only when present — an explicit `undefined` would
  // survive JSON.stringify as a missing key anyway, but building the object
  // this way keeps "what we send" readable in a network trace.
  if (input.product) body.product = input.product;
  if (input.target) body.target = input.target;
  if (input.targetCategory) body.targetCategory = input.targetCategory;
  for (const key of ["source", "medium", "campaign", "content"] as const) {
    const value = input.utm[key];
    if (value) body[key] = value;
  }
  return body;
}

function readSession(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;
    const token = newSessionToken();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    return token;
  } catch {
    // Private mode / storage blocked: still emit events, just ungrouped.
    return newSessionToken();
  }
}

/**
 * Captures UTM on arrival and keeps it for the rest of the tab, so a visitor
 * who lands from links.yulalab.com, browses two pages and then clicks
 * through to the App Store still carries the original campaign. Without
 * this, every outbound would look like direct traffic.
 */
export function rememberUtm(): Utm {
  try {
    const fromUrl = extractUtm(new URLSearchParams(window.location.search));
    if (Object.keys(fromUrl).length > 0) {
      window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const stored = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Utm) : {};
  } catch {
    return {};
  }
}

export type TrackInput = Omit<BuildEventInput, "session" | "utm" | "page" | "locale"> & {
  locale?: EventLocale;
  page?: string;
};

/**
 * Fire-and-forget. Returns void, never throws, never awaits: the caller is
 * usually mid-navigation.
 *
 * sendBeacon is preferred because the browser guarantees delivery attempts
 * after the document is gone. fetch+keepalive is the fallback for browsers
 * without it. If both are missing the event is simply lost — which is the
 * correct trade against blocking a visitor's click.
 */
export function attributionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED === "1";
}

export function track(input: TrackInput): void {
  if (typeof window === "undefined") return;
  // Off by default, and deliberately so. Until an attribution database is
  // provisioned, /api/events answers 503 for every post — firing beacons at
  // it would mean a guaranteed-failing request on every click, and any
  // privacy text describing "events we record" would be describing
  // something that never happens. One environment variable turns the whole
  // chain on once storage exists.
  if (!attributionEnabled()) return;
  try {
    const locale: EventLocale =
      input.locale ?? (window.location.pathname.startsWith("/en") ? "en" : "tr");
    const body = buildEventBody({
      ...input,
      locale,
      page: input.page ?? window.location.pathname,
      session: readSession(),
      utm: rememberUtm(),
    });
    const json = JSON.stringify(body);
    const url = "/api/events";

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([json], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: json,
      keepalive: true,
    }).catch(() => {
      /* Analytics must never surface an error to the visitor. */
    });
  } catch {
    /* Same reasoning: a broken funnel must not break the page. */
  }
}


/**
 * Client-side view of the target category, using the SAME function the
 * server decides with. It was briefly a second implementation of the same
 * rule living in TrackedLink — the exact duplication that let the
 * hand-written `targetCategory="web"` drift away from an App Store
 * destination in the first place. The value is only a hint: the server
 * re-derives it and its answer wins.
 */
export function categoriseTarget(href: string): TargetCategory {
  try {
    return categoryForHost(new URL(href).host);
  } catch {
    return "web";
  }
}
