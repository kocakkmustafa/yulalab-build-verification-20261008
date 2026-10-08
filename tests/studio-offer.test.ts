import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  STUDIO_QUALIFIERS,
  qualificationSummary,
  validateStudioApplication,
  type StudioApplication,
} from "@/lib/studio";

/**
 * Y-P1-004 — the studio offer.
 *
 * Two things make this surface risky in a way the rest of the site is not:
 * it is the page most tempted to promise an outcome, and it is the only one
 * that asks a stranger commercial questions about their own business. Both
 * are locked here rather than left to editorial care.
 */

function goodApplication(): StudioApplication {
  return {
    name: "Ada Yılmaz",
    email: "ada@example.com",
    company: "Example A.Ş.",
    problem: "Ölçüm altyapımız yok; hangi iddiayı yayınlayabileceğimizi bilmiyoruz.",
    budgetBand: "50-150k",
    timing: "1-3-months",
    decisionRole: "founder",
    locale: "tr",
  };
}

describe("studio application", () => {
  it("accepts a complete application", () => {
    expect(validateStudioApplication(goodApplication())).toEqual([]);
  });

  const required: [string, (a: StudioApplication) => void][] = [
    ["name", (a) => { a.name = ""; }],
    ["email", (a) => { a.email = ""; }],
    ["problem", (a) => { a.problem = ""; }],
    ["budget band", (a) => { a.budgetBand = "" as StudioApplication["budgetBand"]; }],
    ["timing", (a) => { a.timing = "" as StudioApplication["timing"]; }],
    ["decision role", (a) => { a.decisionRole = "" as StudioApplication["decisionRole"]; }],
  ];
  for (const [field, break_] of required) {
    it(`refuses an application with no ${field}`, () => {
      const a = goodApplication();
      break_(a);
      expect(validateStudioApplication(a).length).toBeGreaterThan(0);
    });
  }

  it("refuses a budget band that is not one of the offered bands", () => {
    const a = goodApplication();
    a.budgetBand = "1.234.567 TL" as StudioApplication["budgetBand"];
    expect(validateStudioApplication(a).length).toBeGreaterThan(0);
  });

  /**
   * Bands, never exact figures. Asking a stranger's precise budget collects
   * commercially sensitive data we have no need for — the roadmap's
   * "gereksiz hassas veri istemez" made mechanical: the field CANNOT hold a
   * free number because it is an enum.
   */
  it("offers only coarse bands, and every band is a closed choice", () => {
    for (const q of STUDIO_QUALIFIERS) {
      expect(q.options.length).toBeGreaterThan(1);
      for (const option of q.options) {
        expect(option.value).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  /**
   * A decision-maker is asked for their ROLE, not their name. "Who signs
   * this off" is a qualification question; "name the person" is personal
   * data about a third party who never visited this site.
   */
  it("asks for a decision ROLE, never a person's name", () => {
    const decision = STUDIO_QUALIFIERS.find((q) => q.id === "decisionRole");
    expect(decision).toBeDefined();
    // Whole words: a crude /ad$/ flagged the legitimate value
    // "product-lead", which is the false-positive shape that gets a guard
    // switched off.
    const asksForAName = /(?<![\p{L}])(?:name|isim|adı|adınız)(?![\p{L}])/iu;
    expect(decision!.labelTr).not.toMatch(asksForAName);
    expect(decision!.labelEn).not.toMatch(asksForAName);
    for (const option of decision!.options) {
      expect(option.value).not.toMatch(asksForAName);
      expect(option.labelTr).not.toMatch(asksForAName);
      expect(option.labelEn).not.toMatch(asksForAName);
    }
  });

  /**
   * The stored record must say what the applicant was SHOWN. The first
   * version printed the raw enum values, so a person who chose "a mid-sized
   * project budget" had "50-150k" — a numeric band in an unstated currency —
   * attributed to them. This test used to assert that as correct.
   */
  it("summarises the qualification using the labels the applicant saw", () => {
    for (const locale of ["tr", "en"] as const) {
      const summary = qualificationSummary(goodApplication(), locale);
      const band = STUDIO_QUALIFIERS.find((q) => q.id === "budgetBand")!;
      const chosen = band.options.find((o) => o.value === "50-150k")!;
      expect(summary).toContain(locale === "tr" ? chosen.labelTr : chosen.labelEn);
      // The raw enum value, and any numeric band, must NOT appear.
      expect(summary).not.toContain("50-150k");
      expect(summary).not.toMatch(/\d+\s?k\b/i);
      expect(summary).not.toMatch(/undefined|null/);
    }
  });
});

describe("studio page copy", () => {
  const root = process.cwd();
  const page = readFileSync(join(root, "src/app/[locale]/studio/page.tsx"), "utf8");

  /**
   * Measured against the COPY, not the component. Asserting the source
   * matched /notFor/ passed with `const notForWhom = []` — the variable name
   * survived while the section rendered empty.
   */
  it("states who it is NOT for, with real entries in both languages", () => {
    for (const loc of ["tr", "en"] as const) {
      const copy = JSON.parse(readFileSync(join(root, `messages/${loc}.json`), "utf8"));
      expect(copy.studio.notFor.length, `${loc} notFor is empty`).toBeGreaterThanOrEqual(3);
      for (const entry of copy.studio.notFor) expect(entry.trim().length).toBeGreaterThan(10);
    }
  });

  it("carries the required no-guarantee statement in both languages", () => {
    // Read from the published COPY, not the component: the page renders
    // messages, so asserting against the TSX would pass on a file that says
    // nothing at all.
    const tr = JSON.parse(readFileSync(join(root, "messages/tr.json"), "utf8"));
    const en = JSON.parse(readFileSync(join(root, "messages/en.json"), "utf8"));
    expect(tr.studio.noPromiseBody).toMatch(/garanti/i);
    expect(en.studio.noPromiseBody).toMatch(/guarantee/i);

    // The self-contained prohibited-claim corpus below verifies that these
    // exact negative statements remain permitted while affirmative promises
    // are rejected. It does not depend on dirty scanner exports.
  });

  it("names all four stages, each with an exact deliverable", () => {
    // Cutting the stages to two left the old assertion green: it matched the
    // word "aşama", which the heading still contained. Roadmap §5.5 also
    // asks for exact deliverables, not just activity.
    for (const loc of ["tr", "en"] as const) {
      const copy = JSON.parse(readFileSync(join(root, `messages/${loc}.json`), "utf8"));
      expect(copy.studio.stages, `${loc} stage count`).toHaveLength(4);
      for (const stage of copy.studio.stages) {
        expect(stage.title.trim().length).toBeGreaterThan(0);
        expect(stage.body.trim().length).toBeGreaterThan(10);
        expect(stage.deliverable.trim().length, "a stage with no deliverable").toBeGreaterThan(10);
      }
    }
  });

  /**
   * The commercial terms are the founder's call (roadmap R3). Until they
   * exist, the page must say so rather than inventing a price — and this
   * test is what stops a placeholder quietly becoming a claim.
   */
  it("does not state a price or a rate", () => {
    for (const loc of ["tr", "en"] as const) {
      const copy = JSON.parse(readFileSync(join(root, `messages/${loc}.json`), "utf8"));
      const text = JSON.stringify(copy.studio);
      const priceish = text.match(/[€$₺]\s?\d|(\d+\s?(?:TL|EUR|USD))|\d+\s?\/\s?(?:saat|hour|gün|day)/gi);
      expect(priceish ?? [], `${loc} states a price`).toEqual([]);
    }
  });

  /**
   * The applicant is shown labels, never figures — so the record must not
   * attribute a numeric band to somebody who saw none.
   */
  it("shows no numeric band to the applicant", () => {
    for (const loc of ["tr", "en"] as const) {
      const copy = JSON.parse(readFileSync(join(root, `messages/${loc}.json`), "utf8"));
      expect(JSON.stringify(copy.studio)).not.toMatch(/\d+\s?k\b/i);
    }
  });
});

describe("prohibited studio claims", () => {
  const patterns: RegExp[] = [
    /\b(?:we|yula|studio)\s+(?:also\s+)?(?:guarantee|guarantees|fund|funds)\b/i,
    /\b(?:we|yula|studio)\s+provide(?:s)?\s+capital\b/i,
    /\bguaranteed\s+(?:roi|return|result|outcome|success|growth)\b/i,
    /\byour success is guaranteed\b/i,
    /\b(?:funding|capital)\s+is\s+provided\b/i,
    /\bsonuç garantisi (?:veriyoruz|vermekteyiz)\b/i,
    /\b(?:başarı garantimiz var|büyüme garantilidir)\b/i,
    /\b(?:sermayeyi|yatırımlar|başlangıç sermayesi)\s+sağlarız\b/i,
  ];

  function violations(value: string): string[] {
    return patterns.filter((pattern) => pattern.test(value)).map(String);
  }

  function copyValues(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(copyValues);
    if (value && typeof value === "object") {
      return Object.values(value as Record<string, unknown>).flatMap(copyValues);
    }
    return [];
  }

  const promises: [locale: "tr" | "en", sentence: string][] = [
    ["en", "We guarantee results within a quarter."],
    ["en", "We guarantee a return on your investment."],
    ["en", "Guaranteed ROI in one quarter."],
    ["en", "Your success is guaranteed."],
    ["en", "We fund the teams we work with."],
    ["en", "Funding is provided for selected teams."],
    ["en", "We provide capital to the products we build."],
    ["tr", "Sonuç garantisi veriyoruz."],
    ["tr", "Sonuç garantisi vermekteyiz."],
    ["tr", "Başarı garantimiz var."],
    ["tr", "Büyüme garantilidir."],
    ["tr", "Sermayeyi sağlarız."],
    ["tr", "Yatırımlar sağlarız."],
    ["tr", "Başlangıç sermayesi sağlarız."],
  ];

  it.each(promises)("recognises the prohibited %s promise: %s", (_locale, sentence) => {
    expect(violations(sentence).length).toBeGreaterThan(0);
  });

  it("keeps every published Studio sentence free of affirmative outcome, funding and capital promises", () => {
    for (const locale of ["tr", "en"] as const) {
      const parsed = JSON.parse(
        readFileSync(join(process.cwd(), `messages/${locale}.json`), "utf8"),
      );
      for (const value of copyValues(parsed.studio)) {
        expect(violations(value), `${locale} Studio copy: ${value}`).toEqual([]);
      }
    }
  });

  it("keeps inline Studio source free of the same public promises", () => {
    for (const file of [
      "src/app/[locale]/studio/page.tsx",
      "src/components/studio/StudioApplication.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(violations(source), file).toEqual([]);
    }
  });

  it("permits the required honest no-guarantee statements", () => {
    const tr = JSON.parse(readFileSync(join(process.cwd(), "messages/tr.json"), "utf8"));
    const en = JSON.parse(readFileSync(join(process.cwd(), "messages/en.json"), "utf8"));
    expect(tr.studio.noPromiseBody).toMatch(/garanti/i);
    expect(en.studio.noPromiseBody).toMatch(/guarantee/i);
    expect(violations(tr.studio.noPromiseBody)).toEqual([]);
    expect(violations(en.studio.noPromiseBody)).toEqual([]);
  });

  it("still catches a promise appended to the honest sentence", () => {
    const en = JSON.parse(readFileSync(join(process.cwd(), "messages/en.json"), "utf8"));
    expect(violations(`${en.studio.noPromiseBody} We also guarantee results.`).length).toBeGreaterThan(0);
  });
});

describe("home page CTA precedence", () => {
  const root = process.cwd();
  const home = readFileSync(join(root, "src/app/[locale]/page.tsx"), "utf8");
  const overlay = readFileSync(
    join(root, "src/components/experience/ExperienceOverlay.tsx"),
    "utf8",
  );
  const staticExperience = readFileSync(
    join(root, "src/components/experience/StaticExperience.tsx"),
    "utf8",
  );
  const renderers = [overlay, staticExperience];

  /**
   * Roadmap §12 Y-P1-004: "Primary home CTA'yı değiştirme; studio secondary
   * kalır." The home page's job is the product proof, not the service.
   */
  it("keeps the existing primary CTA as the home page's primary action", () => {
    expect(home).toContain("<YulaExperience");
    for (const renderer of renderers) {
      expect(renderer.match(/event="home_primary_cta"/g)).toHaveLength(1);
      expect(renderer).toMatch(
        /<TrackedLink\s+href="#experience-portfolio"\s+event="home_primary_cta"/,
      );
    }
  });

  it("does not promote studio to the primary CTA event", () => {
    for (const renderer of renderers) {
      expect(renderer).not.toMatch(
        /<TrackedLink[\s\S]{0,240}(?:href="\/studio"[\s\S]{0,160}event="home_primary_cta"|event="home_primary_cta"[\s\S]{0,160}href="\/studio")/,
      );
    }
  });
});

describe("studio analytics reach the real parser", () => {
  /**
   * Asserted against `parseEventPayload` — the function the SERVER runs.
   *
   * The first version carried the qualification verdict in `product`, which
   * that parser refuses (it is the per-product funnel index, constrained to
   * registry slugs). Every studio submission event was dropped at the door
   * while views and starts kept landing, so the acceptance gate would have
   * read as a broken offer rather than a broken client — and 748 tests said
   * nothing. Same lesson as the copy corpus: assert against what actually
   * runs.
   */
  const events = [
    "studio_view",
    "studio_application_started",
    "studio_application_submitted",
  ] as const;

  for (const event of events) {
    it(`accepts ${event} exactly as the client sends it`, async () => {
      const { buildEventBody } = await import("@/lib/analytics/client");
      const { parseEventPayload } = await import("@/lib/analytics/events");
      const body = buildEventBody({
        event,
        page: "/studio",
        locale: "tr",
        session: "a".repeat(32),
        utm: {},
      });
      const result = parseEventPayload(body);
      expect(result.ok, `rejected: ${"reason" in result ? result.reason : ""}`).toBe(true);
    });
  }

  /**
   * Executed against a real PostgreSQL, not asserted against the file's text.
   *
   * The previous version checked that every EVENT_NAMES entry appeared as a
   * quoted literal in the migration — which passed on a file that could not
   * run at all: it named a column (`event`) that does not exist and dropped
   * a constraint under a name Postgres never used. A text assertion cannot
   * see a column name. This is the third guard in this review to assert a
   * restatement instead of the thing that runs; running it is the fix.
   */
  it("applies atomically through the documented psql -f boundary", async () => {
    const { createIsolatedSchema, dropSchema, testDatabaseUrl } = await import(
      "./helpers/attribution-db"
    );
    const schema = "studio_events_test";
    const pool = await createIsolatedSchema(schema);
    try {
      const migration = join(process.cwd(), "db/migrations/0004_studio_qualified_event.sql");
      execFileSync(
        "psql",
        ["-X", "-v", "ON_ERROR_STOP=1", "-d", testDatabaseUrl(schema), "-f", migration],
        { stdio: "pipe" },
      );
      const { EVENT_NAMES } = await import("@/lib/analytics/events");
      const accepted = await pool.query(
        `INSERT INTO attributions (event_version, event_name, locale, page_path, session_id_hash)
         SELECT 1, event_name, 'tr', '/studio', repeat('a', 64)
         FROM unnest($1::text[]) AS event_name
         RETURNING event_name`,
        [[...EVENT_NAMES]],
      );
      expect(accepted.rowCount).toBe(EVENT_NAMES.length);
      expect(accepted.rows.map((row) => row.event_name)).toEqual([...EVENT_NAMES]);
      // Pinned to the CHECK-violation SQLSTATE and the constraint's own name.
      // A bare `.rejects.toThrow()` would also be satisfied by a renamed
      // column or a later NOT NULL — it would keep passing while the thing it
      // exists to prove had stopped being true.
      await expect(
        pool.query(
          `INSERT INTO attributions (event_version, event_name, locale, page_path, session_id_hash)
           VALUES (1, 'definitely_not_an_event', 'tr', '/studio', $1)`,
          ["a".repeat(64)],
        ),
        "the constraint accepts anything — it was dropped, not replaced",
      ).rejects.toMatchObject({ code: "23514", constraint: "attributions_event_name_check" });
    } finally {
      await dropSchema(pool, schema);
    }
  });

  it("rolls the DROP back when the replacement constraint fails under psql -f", async () => {
    const { createIsolatedSchema, dropSchema, testDatabaseUrl } = await import(
      "./helpers/attribution-db"
    );
    const schema = "studio_events_failure_test";
    const pool = await createIsolatedSchema(schema);
    const scratch = mkdtempSync(join(tmpdir(), "yula-studio-migration-"));
    try {
      const migration = readFileSync(
        join(process.cwd(), "db/migrations/0004_studio_qualified_event.sql"),
        "utf8",
      );
      const firstExecutable = migration
        .replace(/^\uFEFF/, "")
        .replace(/^(?:\s|--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)*/, "");
      expect(firstExecutable.startsWith("BEGIN;")).toBe(true);
      expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);

      // Fail specifically at the replacement ADD after the DROP. With no
      // explicit transaction this leaves the table unconstrained; with the
      // migration transaction, psql exits and its connection rolls back.
      const broken = migration.replace(
        "CHECK (event_name IN",
        "CHECK (missing_event_name IN",
      );
      expect(broken).not.toBe(migration);
      const rehearsal = join(scratch, "0004-failure-injection.sql");
      writeFileSync(rehearsal, broken);

      expect(() =>
        execFileSync(
          "psql",
          ["-X", "-v", "ON_ERROR_STOP=1", "-d", testDatabaseUrl(schema), "-f", rehearsal],
          { stdio: "pipe" },
        ),
      ).toThrow();

      const { rows } = await pool.query(
        `SELECT pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
         WHERE conrelid = 'attributions'::regclass
           AND conname = 'attributions_event_name_check'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].definition).not.toContain("studio_application_qualified");
      await expect(
        pool.query(
          `INSERT INTO attributions (event_version, event_name, locale, page_path, session_id_hash)
           VALUES (1, 'definitely_not_an_event', 'tr', '/studio', $1)`,
          ["a".repeat(64)],
        ),
        "the old constraint disappeared after the replacement ADD failed",
      ).rejects.toMatchObject({ code: "23514", constraint: "attributions_event_name_check" });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
      await dropSchema(pool, schema);
    }
  });
});

describe("a studio application is routed as one", () => {
  /**
   * `studio` fell through to the general label, so a project application
   * arrived indistinguishable from "hello". The roadmap asks for qualified
   * routing; there was none, and nothing failed — a default branch is the
   * quietest place for a requirement to go missing.
   */
  it("keeps anonymous studio applications on the ordinary studio route", async () => {
    const { routeFor } = await import("@/server/leads");
    expect(routeFor("studio")).toBe("studio");
    // The other intents keep their labels: this is an addition, not a rewire.
    expect(routeFor("press")).toBe("press");
    expect(routeFor("privacy")).toBe("privacy");
    expect(routeFor("product")).toBe("support");
    expect(routeFor("partnership")).toBe("merhaba");
  });

  it("security boundary: sends exact qualifier enums, never a client verdict or anonymous metric", async () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/studio/StudioApplication.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/isQualified\(/);
    expect(src).not.toMatch(/\bqualified\s*:/);
    expect(src).toMatch(/budgetBand:\s*application\.budgetBand/);
    expect(src).toMatch(/timing:\s*application\.timing/);
    expect(src).toMatch(/decisionRole:\s*application\.decisionRole/);
    expect(src).not.toContain('track({ event: "studio_application_qualified" })');
  });
});
