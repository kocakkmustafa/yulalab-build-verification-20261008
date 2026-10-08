import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ALLOWED_FIELDS } from "@/lib/analytics/events";

/**
 * Ties the public privacy copy to the code it describes.
 *
 * The first version of this file grepped four hardcoded phrases and
 * asserted that events.ts contained its own field-name literals — always
 * true. A three-line page containing only those four phrases passed it,
 * which is how "eleven fields" survived while the list actually named
 * twelve things. That is the same failure as the storage test it was
 * written to replace: a test whose title is the only thing being asserted.
 *
 * The list below is now the disclosure contract itself. It is keyed on the
 * DATABASE COLUMNS, not on the fields the browser sends — the page's claim
 * is about what is stored, and the two sets are not the same. Walking
 * ALLOWED_FIELDS alone missed `id` and `purge_at`, which are stored and
 * were undisclosed, and would not have gone red when a column was added.
 */
const DISCLOSURE: Record<string, { tr: string; en: string }> = {
  id: { tr: "rastgele bir kayıt numarası", en: "a random record identifier" },
  event_version: { tr: "olay sürüm numarası", en: "event version number" },
  session_id_hash: { tr: "takma ad", en: "pseudonym" },
  event_name: { tr: "olay adı", en: "event name" },
  product_slug: { tr: "ürün kısa adı", en: "product short name" },
  locale: { tr: "dil", en: "language" },
  source: { tr: "utm_source", en: "utm_source" },
  medium: { tr: "utm_source/medium/campaign/content", en: "utm_source/medium/campaign/content" },
  campaign: { tr: "utm_source/medium/campaign/content", en: "utm_source/medium/campaign/content" },
  content: { tr: "utm_source/medium/campaign/content", en: "utm_source/medium/campaign/content" },
  page_path: { tr: "sayfa yolu", en: "page path" },
  target_url: { tr: "dış bağlantının adresi", en: "address of the outbound link" },
  target_category: { tr: "o bağlantının sınıfı", en: "that link's class" },
  created_at: { tr: "zaman damgası", en: "timestamp" },
  purge_at: { tr: "saklama süresinin sona erdiği tarih", en: "the retention expiry date" },
};

/** Column names declared by the migration, in order. */
function migrationColumns(sql: string): string[] {
  const body = sql.slice(sql.indexOf("CREATE TABLE"), sql.indexOf("CREATE INDEX"));
  const columns: string[] = [];
  for (const line of body.split("\n")) {
    const stripped = line.replace(/--.*$/, "").trim();
    const match = stripped.match(
      /^([a-z_]+)\s+(uuid|text|integer|timestamptz)\b/,
    );
    if (match) columns.push(match[1]);
  }
  return columns;
}

const root = path.resolve(import.meta.dirname, "..");
function read(relative: string): string {
  const absolute = path.resolve(root, relative);
  try {
    return readFileSync(absolute, "utf8");
  } catch {
    // Deliberately a failure, not a skip: this claim spans two repos, and a
    // check that quietly disappears when one is missing is how the earlier
    // forbidden-pattern scan reported "0 hits" while scanning nothing. CI
    // clones the links hub as a sibling for exactly this reason.
    throw new Error(
      `${relative} not found at ${absolute}. This test needs the links hub checked out ` +
        `alongside the site (CI clones kocakkmustafa/yulalab-links into ../links).`,
    );
  }
}

/**
 * Comments stripped before matching. Without this, moving a disclosure
 * sentence into a comment — deleting it from the rendered page — still
 * satisfied every assertion here.
 */
function renderedText(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const privacy = renderedText(read("src/app/[locale]/privacy/page.tsx"));
const claimsOff = /currently OFF|şu an KAPALI/.test(privacy);

const columns = migrationColumns(read("db/migrations/0001_attribution.sql"));

describe("every stored column is disclosed", () => {
  it("finds the migration's columns at all", () => {
    // Guards the parser: a silently-empty column list would make the next
    // assertion vacuously true, which is the failure mode this whole file
    // has now had twice.
    expect(columns.length).toBeGreaterThan(10);
    expect(columns).toContain("session_id_hash");
    expect(columns).toContain("purge_at");
  });

  it("has a disclosure entry for every column the table stores", () => {
    for (const column of columns) {
      expect(
        DISCLOSURE[column],
        `${column} is stored but has no disclosure wording — add it to the privacy page and to this table`,
      ).toBeTruthy();
    }
  });

  it("names no column that the table does not actually have", () => {
    for (const column of Object.keys(DISCLOSURE)) {
      expect(columns, `${column} is disclosed but no longer exists`).toContain(column);
    }
  });

  it("keeps every wire field mapped to a disclosed column", () => {
    // The browser's field names differ from the column names; this is the
    // bridge, so a new wire field cannot slip through either.
    const wireToColumn: Record<string, string> = {
      v: "event_version",
      event: "event_name",
      locale: "locale",
      page: "page_path",
      product: "product_slug",
      target: "target_url",
      targetCategory: "target_category",
      session: "session_id_hash",
      source: "source",
      medium: "medium",
      campaign: "campaign",
      content: "content",
    };
    for (const field of ALLOWED_FIELDS) {
      const column = wireToColumn[field];
      expect(column, `wire field ${field} maps to no column`).toBeTruthy();
      expect(DISCLOSURE[column], `${field} -> ${column} is not disclosed`).toBeTruthy();
    }
  });

  it.each(Object.entries(DISCLOSURE))("discloses %s in both languages", (_field, wording) => {
    expect(privacy, `missing Turkish disclosure: ${wording.tr}`).toContain(wording.tr);
    expect(privacy, `missing English disclosure: ${wording.en}`).toContain(wording.en);
  });

  it("also discloses the timestamp, which is stored but never sent", () => {
    expect(privacy).toContain("zaman damgası");
    expect(privacy).toContain("timestamp");
  });

  it("makes no countable claim it cannot keep", () => {
    // "Nothing outside those eleven fields is stored" was wrong — the list
    // names twelve things. A number on this page is a promise that someone
    // will check.
    expect(privacy).not.toMatch(/eleven fields|on bir alan/);
  });
});

describe("the 'currently OFF' claim matches the code", () => {
  it("keeps the links hub's collector disabled while the page says it is off", () => {
    const hub = read("../links/index.html");
    const match = hub.match(/var ENABLED = (true|false);/);
    expect(match, "links/index.html no longer declares an ENABLED flag").toBeTruthy();
    if (claimsOff) {
      expect(match?.[1], "privacy page says OFF but the links hub collects").toBe("false");
    }
  });

  it("keeps the main site's collector opt-in while the page says it is off", () => {
    // The site's switch is an env var read at build time, so its production
    // value cannot be asserted here. What CAN be asserted is that the code
    // still requires an explicit opt-in rather than defaulting to on.
    expect(read("src/lib/analytics/client.ts")).toContain(
      'process.env.NEXT_PUBLIC_ATTRIBUTION_ENABLED === "1"',
    );
    if (claimsOff) {
      expect(read(".env.example")).not.toMatch(/^NEXT_PUBLIC_ATTRIBUTION_ENABLED=1$/m);
    }
  });
});
