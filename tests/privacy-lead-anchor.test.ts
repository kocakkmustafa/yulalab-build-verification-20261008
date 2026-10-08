import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Ties the contact-data section of /privacy to the columns migration 0002
 * actually creates.
 *
 * The page described the funnel record field by field and said NOTHING about
 * contact data, while the lead backend was already deployed and one
 * environment variable from collecting. This anchor is what makes
 * LEADS_ENABLED safe to set: a column added later without a matching
 * disclosure fails here rather than on the live page.
 *
 * Keyed on the migration file, not on a hand-kept list, for the same reason
 * the attribution anchor is — a hand-kept list is a second source that
 * drifts.
 */
const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.resolve(root, rel), "utf8");

function renderedText(source: string): string {
  // Comments stripped: moving a sentence into a comment deletes it from the
  // page while leaving it in the file.
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const privacy = renderedText(read("src/app/[locale]/privacy/page.tsx"));
const migration = read("db/migrations/0002_leads_consents_outbox.sql");

/** Columns of one CREATE TABLE block in the migration. */
function columnsOf(table: string): string[] {
  const start = migration.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
  expect(start, `no CREATE TABLE for ${table}`).toBeGreaterThan(-1);
  const body = migration.slice(start, migration.indexOf("\n);", start));
  const cols: string[] = [];
  for (const line of body.split("\n")) {
    const stripped = line.replace(/--.*$/, "").trim();
    const m = stripped.match(/^([a-z_]+)\s+(uuid|text|integer|timestamptz|jsonb)\b/);
    if (m) cols.push(m[1]);
  }
  return cols;
}

/** Column → the wording that discloses it, in both languages. */
const LEADS: Record<string, { tr: string; en: string }> = {
  id: { tr: "rastgele bir kayıt numarası", en: "a random record identifier" },
  created_at: { tr: "kaydın oluşturulma tarihi", en: "the date the record was created" },
  name: { tr: "adınız", en: "your name" },
  email: { tr: "e-posta adresiniz", en: "your email address" },
  company: { tr: "şirket adınız", en: "your company" },
  intent: { tr: "hangi konuda yazdığınız", en: "what you are writing about" },
  product_slug: { tr: "hangi ürün", en: "which product" },
  message: { tr: "mesajınızın kendisi", en: "your message itself" },
  locale: { tr: "sayfanın dili", en: "the page language" },
  status: { tr: "talebin bizdeki durumu", en: "the status of the request on our side" },
  retention_until: { tr: "saklama süresinin sona erdiği tarih", en: "the retention expiry date" },
  dedupe_key: { tr: "eşleştirme değeri", en: "a matching value" },
};

const CONSENTS: Record<string, { tr: string; en: string }> = {
  id: { tr: "ayrı bir kayıt", en: "its own record" },
  lead_id: { tr: "ayrı bir kayıt", en: "its own record" },
  notice_version: { tr: "hangi tarihli bildirim metnini", en: "which dated version of the notice" },
  accepted_at: { tr: "ne zaman kabul ettiğiniz", en: "when you accepted it" },
  lawful_basis: { tr: "hukuki dayanağı", en: "the lawful basis" },
};

describe("every column the leads table stores is disclosed", () => {
  it("finds the migration's columns at all", () => {
    // A silently empty list would make the next assertion vacuously true —
    // the failure this project's anchors have already had twice.
    expect(columnsOf("leads").length).toBeGreaterThan(8);
    expect(columnsOf("leads")).toContain("message");
  });

  it("has disclosure wording for every leads column", () => {
    for (const column of columnsOf("leads")) {
      expect(
        LEADS[column],
        `leads.${column} is stored but has no disclosure wording — add it to /privacy and to this table`,
      ).toBeTruthy();
    }
  });

  it("has disclosure wording for every lead_consents column", () => {
    for (const column of columnsOf("lead_consents")) {
      expect(CONSENTS[column], `lead_consents.${column} is undisclosed`).toBeTruthy();
    }
  });

  it.each(Object.entries(LEADS))("discloses leads.%s in both languages", (_col, wording) => {
    expect(privacy, `missing Turkish: ${wording.tr}`).toContain(wording.tr);
    expect(privacy, `missing English: ${wording.en}`).toContain(wording.en);
  });

  it.each(Object.entries(CONSENTS))("discloses lead_consents.%s in both languages", (_col, wording) => {
    expect(privacy).toContain(wording.tr);
    expect(privacy).toContain(wording.en);
  });
});

describe("the queue and the retentions are described accurately", () => {
  it("says the queue does not carry the message body", () => {
    expect(privacy).toMatch(/kuyruk mesajınızın metnini TAŞIMAZ/);
    expect(privacy).toMatch(/does NOT carry the text of your message/);
  });

  it("states both retention periods, matching the migration", () => {
    expect(migration).toContain("interval '180 days'");
    expect(migration).toContain("interval '30 days'");
    expect(privacy).toMatch(/180 gün/);
    expect(privacy).toMatch(/30 gün/);
    expect(privacy).toMatch(/180 days/);
    expect(privacy).toMatch(/30 days/);
  });

  it("keeps one switch for the sink, the form and this page", () => {
    // The switch moved out of the route so the contact page could read it
    // too; it must not grow a second copy on the way. Only the exact string
    // "1" opens it, and .env.example must not ship it on.
    expect(read("src/server/lead-surface.ts")).toContain('process.env.LEADS_ENABLED === "1"');
    expect(read("src/app/api/leads/route.ts")).toContain(
      'from "@/server/lead-surface"',
    );
    expect(read("src/app/[locale]/contact/page.tsx")).toContain(
      'from "@/server/lead-surface"',
    );
    expect(read(".env.example")).not.toMatch(/^LEADS_ENABLED=1$/m);
  });

  it("lets that switch decide whether a form is described, rather than a sentence", () => {
    // "There is no contact form" is a statement in a privacy notice. It was
    // true when written and stays written after a form appears, describing
    // a site other than the one in front of the reader. Both sentences now
    // exist and `formOpen` picks between them, so the page cannot fall out
    // of step with the deployment.
    expect(privacy).toMatch(/iletişim formu YOK/);
    expect(privacy).toMatch(/no contact form on the site today/);
    expect(privacy).toMatch(/Sitede bir iletişim formu var/);
    expect(privacy).toMatch(/There is a contact form on the site/);
    expect(privacy).toMatch(/formOpen\s*\?/);
    expect(privacy).toContain("leadsEnabled()");
  });
});
