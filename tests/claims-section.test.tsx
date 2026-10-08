// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ClaimsSection } from "@/components/projects/ClaimsSection";
import { presentClaims } from "@/lib/proof";
import { publicRegistry } from "@/data/public-registry";
import type { PresentedClaim } from "@/lib/proof";

afterEach(cleanup);

const LABELS = {
  heading: "Verified claims",
  lapsedHeading: "Needs re-verification",
  lapsedNote: "These claims have outrun their verification window.",
};

function claim(id: string) {
  return {
    id,
    statementTr: `TR ${id}`,
    statementEn: `EN ${id}`,
    evidenceKind: "measured" as const,
    source: "https://example.com/proof",
    scopeTr: "kapsam",
    scopeEn: "scope",
    owner: "owner",
    verifiedAt: "2026-07-01",
    expiresAt: "2026-12-01",
  };
}

const verified = (id: string): PresentedClaim => ({ kind: "verified", claim: claim(id) });
const lapsed = (id: string): PresentedClaim => ({
  kind: "lapsed",
  claim: claim(id),
  expiredOn: "2026-08-01",
});

function renderSection(presented: PresentedClaim[]) {
  return render(<ClaimsSection presented={presented} locale="en" labels={LABELS} />);
}

describe("the section actually renders", () => {
  // Mutation the previous grep-based guard survived: deleting the rendered
  // section while keeping the presentClaims call — "computed, rendered
  // nowhere", the very defect this feature was written to kill.
  it("renders a heading and the claims", () => {
    renderSection([verified("a"), verified("b")]);
    expect(screen.getByRole("heading", { name: "Verified claims", level: 2 })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders nothing at all when a product has no claims", () => {
    const { container } = renderSection([]);
    expect(container.querySelector("section")).toBeNull();
  });
});

describe("lapsed claims are separated, not mixed in", () => {
  // Mutation survived before: filtering lapsed claims out of the page
  // entirely. And the module comment promised separation the UI did not do.
  it("keeps lapsed claims out of the verified list", () => {
    renderSection([verified("fresh"), lapsed("old")]);
    const verifiedList = screen.getAllByRole("list")[0];
    const items = within(verifiedList).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(verifiedList).queryByText("EN old")).toBeNull();
  });

  it("still shows them, under their own heading", () => {
    renderSection([verified("fresh"), lapsed("old")]);
    expect(
      screen.getByRole("heading", { name: /Needs re-verification \(1\)/, level: 3 }),
    ).toBeTruthy();
    expect(screen.getByText("EN old")).toBeTruthy();
  });

  it("counts only lapsed CLAIMS in that heading", () => {
    // The LifeOS bug: a stale 24-hour store surface must never inflate this.
    // The component is given claims only, so a surface cannot reach it —
    // which is the structural version of the fix.
    renderSection([verified("a"), verified("b"), lapsed("x")]);
    expect(screen.getByRole("heading", { name: /\(1\)/, level: 3 })).toBeTruthy();
  });

  it("shows no lapsed heading when nothing has lapsed", () => {
    renderSection([verified("a")]);
    expect(screen.queryByRole("heading", { name: /Needs re-verification/ })).toBeNull();
  });

  it("explains what lapsed means rather than just flagging it", () => {
    renderSection([lapsed("old")]);
    expect(screen.getByText(/outrun their verification window/i)).toBeTruthy();
  });
});

describe("list semantics survive list-style:none", () => {
  it("marks both groups as lists explicitly", () => {
    // Safari/VoiceOver drops list semantics when list-style is none, so
    // "3 items" is never announced without an explicit role.
    renderSection([verified("a"), lapsed("b")]);
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(2);
    for (const l of lists) expect(l.getAttribute("role")).toBe("list");
  });
});

describe("against the real registry", () => {
  it("renders Burun Farkı's real claims", () => {
    const bf = publicRegistry.find((r) => r.slug === "burunfarki")!;
    renderSection(presentClaims(bf, new Date("2026-08-19T12:00:00+03:00")));
    expect(screen.getAllByRole("listitem").length).toBe(bf.claims.length);
  });

  it("moves them under the lapsed heading once their window closes", () => {
    const bf = publicRegistry.find((r) => r.slug === "burunfarki")!;
    renderSection(presentClaims(bf, new Date("2099-01-01T12:00:00+03:00")));
    expect(screen.getByRole("heading", { name: /Needs re-verification/, level: 3 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Verified claims", level: 2 })).toBeTruthy();
    // Nothing left in the verified list.
    expect(screen.getAllByRole("list")).toHaveLength(1);
  });
});
