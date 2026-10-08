// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProofCard } from "@/components/common/ProofCard";
import type { PresentedClaim } from "@/lib/proof";

afterEach(cleanup);

const claim = {
  id: "c1",
  statementTr: "Top-3 doğruluk ~%61",
  statementEn: "Top-3 accuracy ~61%",
  evidenceKind: "measured" as const,
  source: "https://burunfark.com/model-performance",
  scopeTr: "walk-forward, 2026-07-23",
  scopeEn: "walk-forward, 2026-07-23",
  owner: "Burun Farkı",
  verifiedAt: "2026-07-23",
  expiresAt: "2026-08-22",
};

const verified: PresentedClaim = { kind: "verified", claim };
const lapsed: PresentedClaim = { kind: "lapsed", claim, expiredOn: "2026-08-01" };

describe("a verified claim", () => {
  it("shows the statement, how it was established, and a followable source", () => {
    render(<ProofCard presented={verified} locale="en" />);
    expect(screen.getByText("Top-3 accuracy ~61%")).toBeTruthy();
    expect(screen.getByText("measured")).toBeTruthy();
    const source = screen.getByText("source") as HTMLAnchorElement;
    expect(source.getAttribute("href")).toBe("https://burunfark.com/model-performance");
  });

  it("carries no re-verification warning", () => {
    render(<ProofCard presented={verified} locale="en" />);
    expect(screen.queryByText(/needs re-verification/i)).toBeNull();
  });
});

describe("a lapsed claim", () => {
  it("is still rendered rather than silently dropped", () => {
    // Dropping it would shrink the page with nobody learning that
    // verification lapsed — an invisible failure.
    render(<ProofCard presented={lapsed} locale="en" />);
    expect(screen.getByText("Top-3 accuracy ~61%")).toBeTruthy();
  });

  it("says so IN WORDS, not by colour alone", () => {
    // Roadmap §1.4: status is never carried by hue alone. A colourblind
    // reader, a screen reader and a printed page must all get this.
    render(<ProofCard presented={lapsed} locale="en" />);
    expect(screen.getByText(/needs re-verification — window closed 2026-08-01/i)).toBeTruthy();
  });

  it("says so in Turkish too", () => {
    render(<ProofCard presented={lapsed} locale="tr" />);
    expect(screen.getByText(/yeniden doğrulanmalı — süre 2026-08-01 tarihinde doldu/i)).toBeTruthy();
    expect(screen.getByText("Top-3 doğruluk ~%61")).toBeTruthy();
  });

  it("names the date the window closed, not just that it closed", () => {
    render(<ProofCard presented={lapsed} locale="en" />);
    expect(screen.getByText(/2026-08-01/)).toBeTruthy();
  });
});

describe("a source the reader cannot open", () => {
  it("is labelled an internal record, never dressed up as a followable link", () => {
    // Behaviour deliberately changed: it used to render the bare path,
    // which put a private repo path under the word "source" and invited a
    // reader to go check something they have no access to. Detail lives in
    // tests/source-stamp.test.tsx.
    render(
      <ProofCard
        presented={{ kind: "verified", claim: { ...claim, source: "ventures/lifeos/lib/perma_service.dart" } }}
        locale="en"
      />,
    );
    expect(screen.getByText(/internal record: ventures\/lifeos\/lib\/perma_service\.dart/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
