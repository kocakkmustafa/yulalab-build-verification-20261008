import { publicRegistry } from "@/data/public-registry";
import { projects } from "@/data/projects";

/**
 * The complete funnel vocabulary (roadmap §8.1). This is an allowlist, not
 * a suggestion: the API route rejects anything outside it. A closed
 * vocabulary is what makes "no raw message, name, email, health, finance,
 * prompt or product user data enters an event" enforceable rather than
 * aspirational — there is simply nowhere for such a value to go.
 */
export const EVENT_NAMES = [
  "home_primary_cta",
  "products_filter_changed",
  "product_view",
  "product_primary_cta",
  "store_outbound",
  "demo_request_started",
  "demo_request_submitted",
  "case_study_view",
  "case_study_cta",
  "studio_view",
  "studio_application_started",
  "studio_application_submitted",
  "support_outbound",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/**
 * Bumped only when the stored shape changes meaningfully. Stored per row so
 * a later aggregation can tell v1 rows from v2 rows instead of silently
 * averaging two different definitions of the same funnel step.
 */
export const EVENT_VERSION = 1;

export const LOCALES = ["tr", "en"] as const;
export type EventLocale = (typeof LOCALES)[number];

// Exactly the three values categoryForHost() can return. "demo" and
// "support" were carried over from the roadmap's prose and were
// unreachable: the enum accepted them, the CHECK accepted them, and nothing
// could ever produce them — a vocabulary wider than the code is a vocabulary
// that invites a hand-written value back in.
export const TARGET_CATEGORIES = ["store", "web", "internal"] as const;
export type TargetCategory = (typeof TARGET_CATEGORIES)[number];

/** Events that are meaningless without somewhere they sent the visitor. */
const TARGET_REQUIRED: ReadonlySet<string> = new Set(["store_outbound", "support_outbound"]);

/**
 * Events that describe something happening *on* the site. A target here
 * would mean the caller is mislabelling a navigation as an interaction,
 * which would inflate outbound counts — the one number this whole task
 * exists to measure honestly.
 */
const TARGET_FORBIDDEN: ReadonlySet<string> = new Set([
  "products_filter_changed",
  "product_view",
  "case_study_view",
  "studio_view",
  "demo_request_started",
  "demo_request_submitted",
  "studio_application_started",
  "studio_application_submitted",
]);

/** UTM values are machine tokens, never prose. */
const UTM_PATTERN = /^[A-Za-z0-9_\-.]{1,64}$/;
const UTM_FIELDS = ["source", "medium", "campaign", "content"] as const;

/** Opaque client-generated token: 32 lowercase hex chars. Never stored raw. */
const SESSION_PATTERN = /^[a-f0-9]{32}$/;

/**
 * A site-relative route path and nothing else: slug characters, slashes,
 * dots for extensions. No spaces, no `@`, no punctuation prose needs, no
 * query, no fragment, no control characters — so a sentence, an email
 * address, a forged log line or a NUL byte cannot be a page path. 128 chars
 * is comfortably longer than the deepest route the site generates.
 */
export const PAGE_PATTERN = "^/[A-Za-z0-9/_.-]{0,127}$";

/** Generous for a real store/product URL, far below anything worth storing. */
const MAX_TARGET_LENGTH = 512;

export const ALLOWED_FIELDS = new Set([
  "v",
  "event",
  "locale",
  "page",
  "product",
  "target",
  "targetCategory",
  "session",
  ...UTM_FIELDS,
]);

export type EventPayload = {
  v: number;
  event: EventName;
  locale: EventLocale;
  page: string;
  product?: string;
  target?: string;
  targetCategory?: TargetCategory;
  session: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
};

/**
 * The one rule for a stored outbound URL, shared with the database.
 *
 * `db/migrations/0001_attribution.sql` carries this pattern character for
 * character, and `tests/target-rule-parity.test.ts` fails if the two ever
 * drift. They already had: the app accepted `@` in a path while the CHECK
 * rejected it, so a perfectly real repo URL
 * (`https://youtube.com/@burunfarki`) would have passed validation and then
 * died as a 503 on a constraint violation. Two copies of a rule is one rule
 * and one bug waiting.
 *
 * `%` and `+` are excluded deliberately. Stripping the query string closed
 * the obvious leak, but the PATH was still verbatim — so
 * `/%73%6f%6d%65%6f%6e%65%40...` decoded to an email address and stored,
 * which is the same defect one encoding layer down. `@` goes too: it is
 * what makes `/kaan@example.com` a path. Handle-style URLs
 * (`youtube.com/@name`) are therefore not trackable, which costs nothing —
 * social links are deliberately outside the funnel — and now fails as a
 * clean 400 rather than a database error.
 */
export const TARGET_URL_PATTERN = "^https://[A-Za-z0-9.-]+(/[A-Za-z0-9/_.~-]*)?$";

/** Origin + pathname, discarding query and fragment. */
export function normaliseTarget(raw: string): string {
  const url = new URL(raw);
  return `${url.origin}${url.pathname}`;
}

/**
 * Server-side truth for the target category. The client sends one, but a
 * sender that mislabels a store click as `internal` would silently corrupt
 * the outbound/store split — the one number this endpoint exists to report
 * — so the server decides and the client's value is only a hint.
 */
export function categoryForHost(host: string): TargetCategory {
  if (host === "apps.apple.com" || host === "play.google.com") return "store";
  if (FIRST_PARTY_HOSTS.includes(host)) return "internal";
  return "web";
}

export type ParseResult =
  | { ok: true; value: EventPayload }
  | { ok: false; reason: string };

/** Our own surfaces, so an internal CTA target is not treated as a stranger. */
const FIRST_PARTY_HOSTS = ["yulalab.com", "www.yulalab.com", "links.yulalab.com"];

/**
 * Outbound hosts are derived from the public registry rather than hardcoded,
 * for the same reason store URLs were centralised in Y-P0-003: two lists
 * drift, one does not. It is also a security boundary — without it the
 * endpoint is an open logging relay that will record any URL a stranger
 * posts at it.
 */
export function outboundHostAllowlist(): Set<string> {
  const hosts = new Set<string>(FIRST_PARTY_HOSTS);
  const add = (raw: string | null | undefined) => {
    if (!raw) return;
    try {
      hosts.add(new URL(raw).host);
    } catch {
      // Relative paths (e.g. "/privacy/lifeos") are first-party by
      // construction and already covered above.
    }
  };
  for (const record of publicRegistry) {
    for (const surface of record.surfaces) add(surface.url);
    add(record.primaryCta.url);
    add(record.privacyUrl);
    add(record.supportUrl);
  }
  // ProjectConfig.links is the OTHER place outbound URLs still live —
  // social profiles and per-product sites that never made it into the
  // registry (the known Y-P0-003 leftover, tracked for Y-P1-001). Reading
  // both is not belt-and-braces; measured against a real browser, the
  // registry alone once rejected a project-owned CTA with a 400, because
  // that destination existed only in this list. Collapse this loop into
  // the one above when the two sources become one.
  for (const project of projects) {
    for (const link of project.links) add(link.href);
  }
  return hosts;
}

const PRODUCT_SLUGS = new Set(publicRegistry.map((record) => record.slug));

function fail(reason: string): ParseResult {
  return { ok: false, reason };
}

/**
 * Validates one incoming event.
 *
 * Unknown fields are REJECTED rather than stripped. Stripping would accept
 * the request and quietly discard whatever was sent, which is the worse
 * failure: a caller that accidentally attaches an email address gets a 202
 * and believes the data was handled, and nobody ever learns the field
 * existed. A 400 naming the field is loud, and — importantly — names only
 * the key, never the value, because this string is logged.
 */
export function parseEventPayload(input: unknown): ParseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail("payload must be an object");
  }
  const body = input as Record<string, unknown>;

  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) return fail(`unknown field "${key}"`);
  }

  if (body.v !== EVENT_VERSION) return fail(`unsupported event version`);

  if (typeof body.event !== "string" || !(EVENT_NAMES as readonly string[]).includes(body.event)) {
    return fail("unknown event name");
  }
  const event = body.event as EventName;

  if (typeof body.locale !== "string" || !(LOCALES as readonly string[]).includes(body.locale)) {
    return fail("locale must be tr or en");
  }

  // Rejecting unknown FIELDS is not the same as constraining the VALUES of
  // known ones — a distinction this validator originally missed, so
  // `page: "/kaan@example.com is my email"` was accepted and stored while
  // the privacy page claimed such data "technically cannot" enter. A route
  // path is a machine token; anything that is not one is not a page.
  if (typeof body.page !== "string" || !new RegExp(PAGE_PATTERN).test(body.page)) {
    return fail("page must be a site-relative route path");
  }
  if (body.page.includes("//")) {
    return fail("page must not contain a protocol-relative prefix");
  }
  if (body.page.includes("..")) {
    // Never a real route, and cheap to refuse.
    return fail("page must not contain a traversal segment");
  }

  if (body.product !== undefined) {
    if (typeof body.product !== "string" || !PRODUCT_SLUGS.has(body.product)) {
      return fail("product must be a slug published in the public registry");
    }
  }

  if (body.session === undefined) return fail("session token required");
  if (typeof body.session !== "string" || !SESSION_PATTERN.test(body.session)) {
    return fail("session token has the wrong shape");
  }

  for (const field of UTM_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || !UTM_PATTERN.test(value)) {
      return fail(`${field} must be a short token of [A-Za-z0-9_-.]`);
    }
  }

  const hasTarget = body.target !== undefined;
  if (TARGET_REQUIRED.has(event) && !hasTarget) {
    return fail(`event ${event} requires a target`);
  }
  if (TARGET_FORBIDDEN.has(event) && hasTarget) {
    return fail(`event ${event} must not carry a target`);
  }

  if (hasTarget) {
    if (typeof body.target !== "string") return fail("target must be a URL string");
    let url: URL;
    try {
      url = new URL(body.target);
    } catch {
      return fail("target must be an absolute URL");
    }
    if (url.protocol !== "https:") return fail("target must be https");
    if (body.target.length > MAX_TARGET_LENGTH) return fail("target too long");
    if (!outboundHostAllowlist().has(url.host)) {
      return fail("target host is not published in the public registry");
    }
    // Checked against the value that will actually be STORED, not against
    // what arrived — otherwise the rule describes a string the database
    // never sees.
    const normalised = normaliseTarget(body.target);
    if (!new RegExp(TARGET_URL_PATTERN).test(normalised)) {
      return fail("target path may only contain route characters");
    }
    if (normalised.length > MAX_TARGET_LENGTH) return fail("target too long");
    if (
      typeof body.targetCategory !== "string" ||
      !(TARGET_CATEGORIES as readonly string[]).includes(body.targetCategory)
    ) {
      return fail("targetCategory required alongside target");
    }
  } else if (body.targetCategory !== undefined) {
    return fail("targetCategory without a target");
  }

  return {
    ok: true,
    value: {
      v: EVENT_VERSION,
      event,
      locale: body.locale as EventLocale,
      page: body.page,
      product: body.product as string | undefined,
      // Origin + path only. The same reasoning that strips the query from
      // `page` applies here and was originally missed: an outbound URL is
      // just as capable of carrying `?ref=someone@example.com`, and storing
      // it verbatim would have re-opened the leak the page rule closes.
      target: hasTarget ? normaliseTarget(body.target as string) : undefined,
      // Derived, not trusted (see categoryForHost).
      targetCategory: hasTarget
        ? categoryForHost(new URL(body.target as string).host)
        : undefined,
      session: body.session,
      source: body.source as string | undefined,
      medium: body.medium as string | undefined,
      campaign: body.campaign as string | undefined,
      content: body.content as string | undefined,
    },
  };
}
