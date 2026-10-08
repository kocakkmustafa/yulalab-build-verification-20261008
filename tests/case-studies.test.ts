import { describe, it, expect } from "vitest";
import {
  validateCaseStudy,
  validateCaseStudies,
  publishableCaseStudies,
  type CaseStudy,
} from "@/lib/case-studies";
import { caseStudies } from "@/data/case-studies";
import { publicRegistry } from "@/data/public-registry";

/**
 * The case-study gate (roadmap Y-P1-003).
 *
 * A case study is the strongest claim this site can make — it asserts an
 * outcome about a real product, and often about a real person or customer.
 * So the bar is structural, not editorial: a case that cannot prove its
 * source, its permission, its baseline, its artifact, its measurement and
 * its failure lesson does not render. The build fails rather than shipping
 * an unbacked story.
 */

/** A fully-formed case, used to prove the gate is not a blanket "no". */
function goodCase(): CaseStudy {
  return {
    slug: "fixture-case",
    productSlug: "burunfarki",
    titleTr: "Fixture vakası",
    titleEn: "Fixture case",
    permission: {
      kind: "self-owned",
      grantedBy: "YULA Lab",
      grantedAt: "2026-08-01",
      scopeTr: "Ürün YULA'ya ait; kişi/müşteri kimliği paylaşılmıyor.",
      scopeEn: "Product is YULA-owned; no person or customer identity is shared.",
    },
    baselineTr: "Başlangıç durumu.",
    baselineEn: "Starting state.",
    constraintTr: "Kısıt.",
    constraintEn: "Constraint.",
    decisions: [
      { date: "2026-07-01", summaryTr: "Karar.", summaryEn: "Decision." },
    ],
    artifacts: [
      {
        kind: "code",
        labelTr: "Doğrulayıcı",
        labelEn: "Validator",
        source: "src/lib/public-registry.ts",
      },
    ],
    outcome: {
      claimId: "burunfarki-topk-accuracy",
      figure: "~%62",
      metricTr: "Top-3 doğruluğu",
      metricEn: "Top-3 accuracy",
    },
    failureTr: "Ne başarısız oldu.",
    failureEn: "What failed.",
    changedAfterTr: "Sonrasında ne değişti.",
    changedAfterEn: "What changed after.",
    verifiedAt: "2026-08-01",
    expiresAt: "2026-11-01",
  };
}

describe("case-study gate", () => {
  it("accepts a fully-formed case (the gate is not a blanket refusal)", () => {
    expect(validateCaseStudy(goodCase(), publicRegistry)).toEqual([]);
  });

  const required: [string, (c: CaseStudy) => void][] = [
    ["permission", (c) => { (c as { permission?: unknown }).permission = undefined; }],
    ["baseline", (c) => { c.baselineTr = ""; c.baselineEn = ""; }],
    ["artifact", (c) => { c.artifacts = []; }],
    ["outcome", (c) => { (c as { outcome?: unknown }).outcome = undefined; }],
    ["failure/lesson", (c) => { c.failureTr = ""; c.failureEn = ""; }],
    ["validity date", (c) => { c.expiresAt = ""; }],
    ["decision log", (c) => { c.decisions = []; }],
  ];

  for (const [field, break_] of required) {
    it(`REFUSES a case missing its ${field}`, () => {
      const c = goodCase();
      break_(c);
      expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
    });
  }

  it("refuses an artifact with no source path", () => {
    const c = goodCase();
    c.artifacts = [{ kind: "code", labelTr: "x", labelEn: "x", source: "" }];
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  it("refuses a case about a product that is not in the public registry", () => {
    const c = goodCase();
    c.productSlug = "not-a-product";
    // Named specifically: asserting only "some error" passed even with the
    // registry rule deleted, because the claimId error fires independently.
    expect(validateCaseStudy(c, publicRegistry).join(" ")).toMatch(/not in the public registry/);
  });


  /**
   * Every case below was ACCEPTED by the first version of this gate, which
   * substring-matched against the claim's prose. Each is a regression the
   * stat-card guard already had a named test for — reintroduced here, and
   * now locked at this surface too.
   */
  const figureAttacks: [string, string, string][] = [
    ["a figure the claim mentions only to DISCLAIM", "burunfarki-topk-accuracy", "~%69"],
    ["a number recovered from the claim's ISO date", "burunfarki-topk-accuracy", "19"],
    ["a bare substring of a real figure", "burunfarki-topk-accuracy", "~%6"],
    ["a decimal that collapses onto a real figure", "burunfarki-topk-accuracy", "~%6.1"],
  ];
  for (const [label, claimId, figure] of figureAttacks) {
    it(`REFUSES ${label} ("${figure}")`, () => {
      const c = goodCase();
      c.outcome.claimId = claimId;
      c.outcome.figure = figure;
      expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
    });
  }

  /**
   * The number a reader SEES was unchecked: only the declared array was
   * compared, so an undeclared figure in the rendered sentence sailed
   * through and printed under "Measured outcome".
   */


  it("REFUSES a blank decision entry", () => {
    const c = goodCase();
    c.decisions = [{ date: "2026-07-01", summaryTr: "", summaryEn: "" }];
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  it("REFUSES a non-ISO decision date (it renders to both locales)", () => {
    const c = goodCase();
    c.decisions = [{ date: "Temmuz 2026", summaryTr: "x", summaryEn: "x" }];
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  it("REFUSES a validity window that never opened", () => {
    const c = goodCase();
    c.verifiedAt = "2026-12-01";
    c.expiresAt = "2026-01-01";
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  it("REFUSES a permission granted after the case was verified", () => {
    const c = goodCase();
    c.permission.grantedAt = "2099-01-01";
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  it("REFUSES a self-owned case that credits somebody else's organisation", () => {
    const c = goodCase();
    c.permission.grantedBy = "Acme Bank A.S.";
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  /**
   * The composed model's whole guarantee: a case supplies a LABEL and a
   * pointer, never a number. These are the four review rounds' attacks
   * restated against it — each one is now unrepresentable rather than
   * refused, because there is no sentence field to put them in.
   */
  it("REFUSES a figure the claim does not declare (the disclaimed ~%69)", () => {
    const c = goodCase();
    c.outcome.figure = "~%69";
    expect(validateCaseStudy(c, publicRegistry).join(" ")).toMatch(/declared figures/);
  });

  it("REFUSES a figure the registry has never held", () => {
    const c = goodCase();
    c.outcome.figure = "%95";
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  it("REFUSES a number recovered from the claim's ISO date", () => {
    const c = goodCase();
    c.outcome.figure = "19";
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  it("REFUSES a bare substring of a real figure", () => {
    const c = goodCase();
    c.outcome.figure = "~%6";
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  const metricAttacks: [string, string, string][] = [
    ["a digit smuggled into the metric label", "Doğruluk %95", "Accuracy 95%"],
    ["a whole sentence used as a metric", "Doğruluk ~%69'a çıktı", "Accuracy rose to 95%"],
    ["a spelled-out magnitude in the metric", "Gelir üçe katlandı", "Revenue tripled"],
    ["a magnitude phrase in the metric", "Gecikme yarısına indi", "Latency cut in half"],
  ];
  for (const [label, tr, en] of metricAttacks) {
    it(`REFUSES ${label}`, () => {
      const c = goodCase();
      c.outcome.metricTr = tr;
      c.outcome.metricEn = en;
      expect(validateCaseStudy(c, publicRegistry).length, `accepted: ${en}`).toBeGreaterThan(0);
    });
  }

  /** The guard must not fire on an ordinary label, or it gets switched off. */
  /** The guard must not fire on an ordinary label, or it gets switched off. */
  const honestMetrics: [string, string][] = [
    ["Top-3 doğruluğu", "Top-3 accuracy"],
    ["AES-256 şifreleme kapsamı", "AES-256 encryption coverage"],
    ["Cihaz üstü şifreleme", "On-device encryption"],
    // Ordinary words the earlier word list wrongly flagged.
    ["Ondalık ayırıcı doğruluğu", "Decimal separator accuracy"],
    ["Kutu altı gecikmesi", "Bottom-of-box latency"],
    ["Çift kör inceleme kapsamı", "Double-blind review coverage"],
  ];
  for (const [tr, en] of honestMetrics) {
    it(`ACCEPTS the ordinary metric label "${en}"`, () => {
      const c = goodCase();
      c.outcome.metricTr = tr;
      c.outcome.metricEn = en;
      expect(validateCaseStudy(c, publicRegistry), `refused: ${en}`).toEqual([]);
    });
  }

  /** The label-shape constraint is what admits "Top-3" without admitting a
   *  measurement; a value that is not label-shaped must not slip through. */
  const nonLabelShapes: [string, string][] = [
    ["Doğruluk 95", "Accuracy 95"],
    ["Doğruluk %95", "Accuracy 95%"],
    ["3 numaralı koşuda doğruluk", "accuracy in run 3"],
  ];
  for (const [tr, en] of nonLabelShapes) {
    it(`REFUSES the non-label-shaped metric "${en}"`, () => {
      const c = goodCase();
      c.outcome.metricTr = tr;
      c.outcome.metricEn = en;
      expect(validateCaseStudy(c, publicRegistry).length, `accepted: ${en}`).toBeGreaterThan(0);
    });
  }

  /**
   * Round-5 review: nine author-written fields rendered unchecked, putting
   * "95%" into the <h1>, the <title> and the meta description beside a
   * correct registry figure. Title and changedAfter read as claims and are
   * now scanned; the narrative fields stay free, and /operating-system says
   * exactly which is which.
   */
  const claimLikeFields: [string, (c: CaseStudy, v: string) => void][] = [
    ["title", (c, v) => { c.titleTr = v; c.titleEn = v; }],
    ["changedAfter", (c, v) => { c.changedAfterTr = v; c.changedAfterEn = v; }],
  ];
  for (const [field, set] of claimLikeFields) {
    it(`REFUSES a bare figure in ${field}`, () => {
      const c = goodCase();
      set(c, "Doğruluk %95 oldu / Accuracy reached 95%");
      expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
    });
    it(`REFUSES a spelled magnitude in ${field}`, () => {
      const c = goodCase();
      set(c, "Gelir üçe katlandı / Revenue tripled");
      expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
    });
  }

  it("allows an ordinary date reference in a claim-like field", () => {
    // False-reject found in review: prose fields have context, a label does
    // not — only the metric treats a date as a number.
    const c = goodCase();
    c.titleTr = "Burun Farkı'nın 2026 yeniden inşası";
    c.titleEn = "The 2026 rebuild of Burun Farkı";
    c.changedAfterTr = "2026-08-19'da yayına alındı, o gün bugün değişmedi.";
    c.changedAfterEn = "Rolled out on 2026-08-19 and unchanged since.";
    expect(validateCaseStudy(c, publicRegistry)).toEqual([]);
  });

  it("leaves narrative fields free — a number is ordinary in a baseline", () => {
    const c = goodCase();
    c.baselineTr = "3 mühendisle başladık, 12 hafta sürdü.";
    c.baselineEn = "We started with 3 engineers over 12 weeks.";
    c.failureTr = "İlk 2 denemede ölçüm tutmadı.";
    c.failureEn = "The first 2 attempts did not measure.";
    expect(validateCaseStudy(c, publicRegistry)).toEqual([]);
  });

  const metricGaps: [string, string][] = [
    ["a percent sign after a space", "accuracy-95 %"],
    ["the word percent after a label", "Top-3 accuracy-95 percent"],
    ["an ISO date inside a label field", "Top-3 accuracy on 2026-08-19"],
    ["full-width digits", "Accuracy ９５ percent"],
  ];
  for (const [label, metric] of metricGaps) {
    it(`REFUSES ${label} in the metric`, () => {
      const c = goodCase();
      c.outcome.metricTr = metric;
      c.outcome.metricEn = metric;
      expect(validateCaseStudy(c, publicRegistry).length, `accepted: ${metric}`).toBeGreaterThan(0);
    });
  }

  it("refuses an outcome whose claimId does not exist in the registry", () => {
    const c = goodCase();
    c.outcome.claimId = "nope-not-real";
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  /**
   * Third-party permission is a stricter shape than self-owned: naming a
   * customer requires a dated, referenced written grant, because "they said
   * it was fine" is exactly the claim that cannot be checked later.
   */
  it("refuses a third-party case with no written-grant reference", () => {
    const c = goodCase();
    c.permission = {
      kind: "written-third-party",
      grantedBy: "Bir Müşteri",
      grantedAt: "2026-08-01",
      scopeTr: "kapsam",
      scopeEn: "scope",
    };
    expect(validateCaseStudy(c, publicRegistry).length).toBeGreaterThan(0);
  });

  it("accepts a third-party case that carries the grant reference", () => {
    const c = goodCase();
    c.permission = {
      kind: "written-third-party",
      grantedBy: "Bir Müşteri",
      grantedAt: "2026-08-01",
      grantReference: "private/legal/permissions/ornek-2026-08-01.pdf",
      scopeTr: "kapsam",
      scopeEn: "scope",
    };
    expect(validateCaseStudy(c, publicRegistry)).toEqual([]);
  });
});

describe("published case studies", () => {
  it("every published case passes the gate", () => {
    expect(validateCaseStudies(caseStudies, publicRegistry)).toEqual([]);
  });

  /**
   * Today the honest answer is zero: the roadmap's own preconditions for
   * the first two cases (LifeOS revenue verification; a Braavolabs PAID
   * pilot result) are not met. This test is here so that stops being a
   * silent state — if someone adds a case, they must also update this
   * expectation deliberately, having read the gate above.
   */
  it("publishes only cases whose product gates are actually met", () => {
    expect(publishableCaseStudies(caseStudies, publicRegistry)).toHaveLength(0);
  });

  /**
   * Tested against NON-EMPTY input on purpose. The previous version fed the
   * real (empty) array, where filtering and returning everything are
   * indistinguishable — the function's body could be deleted entirely and
   * the suite stayed green.
   */
  describe("temporal gating (non-vacuous)", () => {
    const fresh = () => {
      const c = goodCase();
      c.slug = "temporal-fixture";
      return c;
    };
    // burunfarki-topk-accuracy's own window is what the outcome rests on.
    const claim = publicRegistry
      .find((r) => r.slug === "burunfarki")!
      .claims.find((c) => c.id === "burunfarki-topk-accuracy")!;
    const beforeClaimExpiry = new Date(`${claim.expiresAt}T00:00:00+03:00`);
    const afterClaimExpiry = new Date("2099-01-01T00:00:00+03:00");

    it("publishes a valid, in-window case", () => {
      const c = fresh();
      c.expiresAt = "2099-01-01";
      expect(publishableCaseStudies([c], publicRegistry, beforeClaimExpiry)).toHaveLength(1);
    });

    it("withdraws a case whose OWN window has closed", () => {
      const c = fresh();
      c.verifiedAt = "2026-01-01";
      c.expiresAt = "2026-02-01";
      expect(publishableCaseStudies([c], publicRegistry, beforeClaimExpiry)).toHaveLength(0);
    });

    it("withdraws a case whose SOURCE CLAIM has lapsed — a case may not outlive its number", () => {
      const c = fresh();
      c.expiresAt = "2099-06-01";
      expect(publishableCaseStudies([c], publicRegistry, afterClaimExpiry)).toHaveLength(0);
    });
  });
});
