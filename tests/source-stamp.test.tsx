// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SourceStamp } from "@/components/common/SourceStamp";
import { publicRegistry } from "@/data/public-registry";

afterEach(cleanup);

const base = {
  evidenceKind: "measured" as const,
  verifiedAt: "2026-07-23",
  locale: "en" as const,
};

describe("a publicly checkable source", () => {
  it("is a real followable link", () => {
    render(<SourceStamp {...base} source="https://burunfark.com/model-performance" />);
    const link = screen.getByRole("link") as HTMLAnchorElement;
    expect(link.href).toBe("https://burunfark.com/model-performance");
  });
});

describe("an internal record", () => {
  const internal = "ventures/lifeos/app/lib/core/database/encryption_key_manager.dart";

  it("is never rendered as a link the reader cannot open", () => {
    render(<SourceStamp {...base} source={internal} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says plainly that it is an internal record", () => {
    // Showing a private repo path under the word "source" invites the
    // reader to go check something they have no access to. Naming it is the
    // difference between provenance and provenance theatre.
    render(<SourceStamp {...base} source={internal} />);
    expect(screen.getByText(/internal record/i)).toBeTruthy();
    expect(screen.getByText(new RegExp(internal.slice(0, 30)))).toBeTruthy();
  });

  it("says it in Turkish too", () => {
    render(<SourceStamp {...base} locale="tr" source={internal} />);
    expect(screen.getByText(/iç kayıt/i)).toBeTruthy();
  });
});

describe("the real registry", () => {
  it("stores every public source with a scheme so it can be followed", () => {
    // burunfark.com/model-performance was stored without https://, so the
    // one genuinely public source on the site rendered as dead text.
    //
    // The first version of this pattern only matched apex domains, so
    // www.burunfark.com/x, docs.yulalab.com/x, apps.apple.com/app/id… and
    // play.google.com/store/… all slipped through — each would render as
    // "internal record: apps.apple.com/…", a public URL labelled internal,
    // which is the mirror image of the bug this test exists to prevent.
    const looksLikeDomain = /^(?!https?:\/\/)([a-z0-9-]+\.)+[a-z]{2,}(\/|\?|$)/i;
    // Guard the guard: a pattern that matches nothing passes vacuously.
    expect(looksLikeDomain.test("apps.apple.com/app/id1")).toBe(true);
    expect(looksLikeDomain.test("www.burunfark.com/x")).toBe(true);
    expect(looksLikeDomain.test("https://burunfark.com/x")).toBe(false);
    expect(looksLikeDomain.test("ventures/lifeos/app/lib/x.dart")).toBe(false);
    for (const record of publicRegistry) {
      for (const claim of record.claims) {
        expect(
          looksLikeDomain.test(claim.source),
          `${record.slug}/${claim.id}: source "${claim.source}" looks like a URL but has no scheme`,
        ).toBe(false);
      }
      for (const surface of record.surfaces) {
        expect(
          looksLikeDomain.test(surface.source),
          `${record.slug}/${surface.kind}: source "${surface.source}" looks like a URL but has no scheme`,
        ).toBe(false);
      }
    }
  });
});

describe("the caveat reaches both readerships", () => {
  it("gives every claim a scope in both languages", () => {
    // scope was a single Turkish string, so an English reader received the
    // caveat — the part that stops a number being over-read — in a language
    // they may not read. A caveat nobody can read is not a caveat.
    for (const record of publicRegistry) {
      for (const claim of record.claims) {
        expect(claim.scopeTr.trim(), `${record.slug}/${claim.id} has no Turkish scope`).not.toBe("");
        expect(claim.scopeEn.trim(), `${record.slug}/${claim.id} has no English scope`).not.toBe("");
      }
    }
  });

  it("does not leave the English scope as a copy of the Turkish one", () => {
    // A lazy fix would satisfy the test above by duplicating the string.
    // Allow it only where the text contains NO letters at all — the earlier
    // version allowed any ASCII-letter prose, so a diacritic-free Turkish
    // sentence ("Model performans metrikleri; test verisi 2026.") passed and
    // the check only bit when the text happened to contain ç/ğ/ı/ö/ş/ü.
    const neutral = /^[^\p{L}]*$/u;
    for (const record of publicRegistry) {
      for (const claim of record.claims) {
        if (claim.scopeTr === claim.scopeEn) {
          // Sanity-check the heuristic itself, so it cannot pass vacuously.
          expect(neutral.test("Model performans metrikleri; test verisi 2026.")).toBe(false);
          expect(
            neutral.test(claim.scopeTr),
            `${record.slug}/${claim.id}: scopeEn duplicates Turkish prose`,
          ).toBe(true);
        }
      }
    }
  });

  it("renders the reader's language, not the author's", async () => {
    const { ProofCard } = await import("@/components/common/ProofCard");
    const bf = publicRegistry.find((r) => r.slug === "burunfarki")!;
    const claim = bf.claims[0];
    render(<ProofCard presented={{ kind: "verified", claim }} locale="en" />);
    expect(screen.getByText(new RegExp(claim.scopeEn.slice(0, 25).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeTruthy();
  });
});

describe("a URL behind a login is not a source", () => {
  it("rejects known-authenticated hosts in the registry", () => {
    // https:// makes a source render as a followable link, but scheme is not
    // access: an App Store Connect or Play Console deep link, a private
    // GitHub blob or a Supabase dashboard URL all pass the shape check and
    // would sit under the word "source" with a login wall behind them —
    // provenance theatre with a padlock. The proper fix is an explicit
    // sourceKind field (Y-P1-001's registry-driven IA slice); this is the
    // deny-list that holds the line until then.
    const AUTHENTICATED = [
      "appstoreconnect.apple.com",
      "play.google.com/console",
      "vercel.com/dashboard",
      "supabase.com/dashboard",
      "console.cloud.google.com",
      "github.com/kocakkmustafa",
    ];
    for (const record of publicRegistry) {
      const sources = [
        ...record.claims.map((c) => c.source),
        ...record.surfaces.map((sf) => sf.source),
      ];
      for (const source of sources) {
        for (const host of AUTHENTICATED) {
          expect(
            source.includes(host),
            `${record.slug}: "${source}" points behind a login but is presented as a source`,
          ).toBe(false);
        }
      }
    }
  });
});
