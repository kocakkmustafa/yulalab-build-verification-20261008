import type { ProductPublicRecord } from "./types";
import {
  assertsFigure,
  figureTokens,
  figureTokensWithDates,
  spelledMagnitudes,
  stripLabelTokens,
} from "./figure-match";
import { isExpired } from "./public-registry";

/**
 * Case studies — the strongest claim this site can make.
 *
 * A stat card asserts a number. A case study asserts a STORY about a real
 * product, often involving a real person or customer, and readers weigh it
 * accordingly. So the bar here is structural rather than editorial, in the
 * same spirit as src/lib/public-registry.ts: a case that cannot prove its
 * permission, source, baseline, artifact, measurement and failure lesson
 * does not render — `pnpm verify:claims` and the build fail instead.
 *
 * The one rule worth stating out loud: the outcome may not assert a figure
 * the registry does not already carry, under the claim it points at. This
 * is the drift guard Y-P1-001 built for stat cards, applied to the surface
 * where an unbacked number would do the most damage.
 */

export type CasePermissionKind = "self-owned" | "written-third-party";

export type CasePermission = {
  /**
   * "self-owned" — the subject is a YULA product and no third party's
   * identity appears. "written-third-party" — someone else's name, logo or
   * outcome is used, which requires a dated written grant on file.
   *
   * Modelled as data rather than assumed, because every product in the
   * portfolio is YULA's own today: without the distinction the permission
   * requirement would be a no-op the day a real client arrives.
   */
  kind: CasePermissionKind;
  grantedBy: string;
  /** ISO date the permission was granted. */
  grantedAt: string;
  /**
   * Where the written grant lives. Required for third-party cases — "they
   * were fine with it" is precisely the claim nobody can check later.
   */
  grantReference?: string;
  /** Exactly how much identity/outcome the grant covers — both languages. */
  scopeTr: string;
  scopeEn: string;
};

export type CaseArtifactKind = "code" | "commit" | "measurement" | "document" | "screenshot";

export type CaseArtifact = {
  kind: CaseArtifactKind;
  labelTr: string;
  labelEn: string;
  /** Repo path, commit SHA, or dated measurement note. Never empty. */
  source: string;
};

export type CaseDecision = {
  /**
   * ISO, not a localised string. It was `dateTr`, and the detail page
   * rendered that same Turkish text to English readers — "Temmuz 2026"
   * shipped to /en. Locale formatting belongs at the render, the record
   * stores one machine-checkable value.
   */
  date: string;
  summaryTr: string;
  summaryEn: string;
};

/**
 * The measured outcome — COMPOSED, not authored.
 *
 * Four review rounds killed four different versions of "let the author write
 * a sentence, then prove things about the prose": exact figure matching was
 * evaded by the claim's own disclaimer, then by declared label digits, then
 * by pointing a 'label' at the measurement itself. Each fix added a
 * declaration channel and each channel became the next bypass, because
 * proving properties of arbitrary text is unbounded.
 *
 * So the case no longer supplies a number at all. It names WHICH of the
 * registry claim's declared figures it reports, plus a digit-free label for
 * what was measured; the numeral rendered to the reader is read out of the
 * registry string. There is no sentence to scan, and by construction the
 * only reader-facing figure on the page is one the registry verified.
 *
 * Narrative did not disappear — it lives in baseline / constraint / failure
 * / changedAfter, which are free prose and are not presented as measurement.
 */
export type CaseOutcome = {
  /** The registry claim this outcome rests on. */
  claimId: string;
  /** Exactly one of that claim's declared figures. The renderer prints THIS. */
  figure: string;
  /** What was measured. Digit-free: the number comes from the registry. */
  metricTr: string;
  metricEn: string;
};

export type CaseStudy = {
  slug: string;
  /** Must match a product in the public registry. */
  productSlug: string;
  titleTr: string;
  titleEn: string;
  permission: CasePermission;
  baselineTr: string;
  baselineEn: string;
  constraintTr: string;
  constraintEn: string;
  decisions: CaseDecision[];
  artifacts: CaseArtifact[];
  outcome: CaseOutcome;
  /** What failed. Mandatory: a case with no failure is marketing. */
  failureTr: string;
  failureEn: string;
  changedAfterTr: string;
  changedAfterEn: string;
  verifiedAt: string;
  expiresAt: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The only grantor a self-owned case may name. */
const SELF_OWNER = "YULA Lab";

function bothLanguages(label: string, tr: string, en: string): string[] {
  const errors: string[] = [];
  if (!tr?.trim()) errors.push(`${label} missing (tr)`);
  if (!en?.trim()) errors.push(`${label} missing (en)`);
  return errors;
}

export function validateCaseStudy(
  study: CaseStudy,
  registry: ProductPublicRecord[],
): string[] {
  const errors: string[] = [];
  const where = (msg: string) => `${study.slug ?? "<no slug>"}: ${msg}`;

  if (!study.slug?.trim()) errors.push("case study missing slug");
  for (const e of bothLanguages("title", study.titleTr, study.titleEn)) errors.push(where(e));

  // ---- product ----
  const product = registry.find((r) => r.slug === study.productSlug);
  if (!product) {
    errors.push(where(`productSlug "${study.productSlug}" is not in the public registry`));
  }

  // ---- permission ----
  const p = study.permission;
  if (!p) {
    errors.push(where("permission missing — a case study may not be published without one"));
  } else {
    if (!p.grantedBy?.trim()) errors.push(where("permission missing grantedBy"));
    if (!ISO_DATE.test(p.grantedAt ?? "")) {
      errors.push(where("permission grantedAt must be a canonical YYYY-MM-DD date"));
    }
    for (const e of bothLanguages("permission scope", p.scopeTr, p.scopeEn)) errors.push(where(e));
    // "self-owned" renders as "a YULA-owned product — our own work". A case
    // claiming that while crediting someone else's organisation is exactly
    // the mislabel the third-party branch exists to prevent.
    // Exact, not a prefix: "/^YULA/i" accepted both "YULA Lab & Acme Bank"
    // and "Yulalab Musteri Hizmetleri A.S.", each of which then rendered as
    // "a YULA-owned product — this case describes our own work".
    if (p.kind === "self-owned" && p.grantedBy?.trim() !== SELF_OWNER) {
      errors.push(
        where(
          `self-owned permission is granted by "${p.grantedBy}" — a case naming another party must use written-third-party`,
        ),
      );
    }
    if (p.kind === "written-third-party" && !p.grantReference?.trim()) {
      errors.push(
        where("third-party permission needs grantReference — an unfiled grant cannot be checked later"),
      );
    }
  }

  // ---- narrative spine ----
  for (const e of bothLanguages("baseline", study.baselineTr, study.baselineEn)) errors.push(where(e));
  for (const e of bothLanguages("constraint", study.constraintTr, study.constraintEn)) errors.push(where(e));
  for (const e of bothLanguages("failure/lesson", study.failureTr, study.failureEn)) errors.push(where(e));
  for (const e of bothLanguages("changedAfter", study.changedAfterTr, study.changedAfterEn)) {
    errors.push(where(e));
  }

  if (!study.decisions?.length) {
    errors.push(where("decision log is empty — a case with no decisions explains nothing"));
  }
  // Every other field runs through bothLanguages(); the decision log did not,
  // so blank rows rendered as empty bullets under "Decision log".
  for (const [i, d] of (study.decisions ?? []).entries()) {
    if (!ISO_DATE.test(d.date ?? "")) {
      errors.push(where(`decision ${i + 1} needs a canonical YYYY-MM-DD date`));
    }
    for (const e of bothLanguages(`decision ${i + 1} summary`, d.summaryTr, d.summaryEn)) {
      errors.push(where(e));
    }
  }

  // ---- artifacts ----
  if (!study.artifacts?.length) {
    errors.push(where("no artifact — a case study must point at something real"));
  }
  for (const a of study.artifacts ?? []) {
    if (!a.source?.trim()) {
      errors.push(where(`artifact "${a.labelTr || a.kind}" has no source`));
    }
    for (const e of bothLanguages(`artifact ${a.kind} label`, a.labelTr, a.labelEn)) {
      errors.push(where(e));
    }
  }

  // ---- outcome: composed from the registry, not authored ----
  const o = study.outcome;
  if (!o) {
    errors.push(where("outcome missing — a case study with no measured result is a story"));
  } else {
    for (const e of bothLanguages("outcome metric", o.metricTr, o.metricEn)) errors.push(where(e));

    const claim = product?.claims.find((c) => c.id === o.claimId);
    if (!claim) {
      errors.push(
        where(`outcome claimId "${o.claimId}" is not a claim of product "${study.productSlug}"`),
      );
    } else if (!assertsFigure(claim, o.figure)) {
      // Exact equality against the claim's DECLARED figures. Its prose is
      // never consulted: "~69%" lives in the Burun Farkı statement solely to
      // disclaim it, and every version that read the sentence republished it.
      errors.push(
        where(
          `outcome figure "${o.figure}" is not one of claim "${o.claimId}"'s declared figures`,
        ),
      );
    }

    // The metric is a LABEL, so it may not carry a quantity of its own —
    // neither as digits nor as a word. Short and label-shaped by contract,
    // which is what makes this check total rather than a race against prose.
    for (const [lang, text] of [
      ["tr", o.metricTr],
      ["en", o.metricEn],
    ] as const) {
      // Label-shaped identifiers ("Top-3") are what a metric name legitimately
      // contains; anything else numeric in this field is a measurement the
      // registry did not supply.
      const scannable = stripLabelTokens(text ?? "");
      const digits = figureTokensWithDates(scannable);
      if (digits.length) {
        errors.push(
          where(
            `outcome metric (${lang}) contains the number "${digits[0]}" — the figure is read from the registry, the metric names what was measured`,
          ),
        );
      }
      const words = spelledMagnitudes(scannable, lang);
      if (words.length) {
        errors.push(
          where(
            `outcome metric (${lang}) uses the magnitude word(s) ${words
              .map((w) => `"${w}"`)
              .join(", ")} — a metric names a quantity, it does not assert one`,
          ),
        );
      }
    }
  }

  // ---- fields that function as claims rather than narrative ----
  //
  // A review found nine author-written fields rendering unchecked, and put
  // "95%" into the <h1>, the <title> and the meta description — beside a
  // correct registry figure, in larger type. Title and "what changed after"
  // are assertions about the product; baseline, constraint, decision
  // summaries, artifact labels, permission scope and the failure lesson are
  // narrative, where a number is ordinary ("we started with three
  // engineers") and are deliberately left free. That split is stated
  // verbatim on /operating-system rather than left for a reader to discover.
  const claimLike: [string, string, string][] = [
    ["title", study.titleTr, study.titleEn],
    ["changedAfter", study.changedAfterTr, study.changedAfterEn],
  ];
  for (const [field, tr, en] of claimLike) {
    for (const [lang, text] of [
      ["tr", tr],
      ["en", en],
    ] as const) {
      const scannable = stripLabelTokens(text ?? "");
      // Prose fields, so dates are context: "The 2026 rebuild" and "Rolled
      // out on 2026-08-19" are ordinary sentences. Only the metric LABEL
      // treats a date as a number (T2), because a label has no context to
      // give. A guard that refuses honest prose gets switched off.
      const digits = figureTokens(scannable);
      if (digits.length) {
        errors.push(
          where(
            `${field} (${lang}) states the number "${digits[0]}" — this field is read as a claim, so a figure here must go through the registry`,
          ),
        );
      }
      const words = spelledMagnitudes(scannable, lang);
      if (words.length) {
        errors.push(
          where(
            `${field} (${lang}) uses the magnitude word(s) ${words.map((w) => `"${w}"`).join(", ")}`,
          ),
        );
      }
    }
  }

  // ---- validity ----
  if (!ISO_DATE.test(study.verifiedAt ?? "")) {
    errors.push(where("verifiedAt must be a canonical YYYY-MM-DD date"));
  }
  if (!ISO_DATE.test(study.expiresAt ?? "")) {
    errors.push(where("expiresAt must be a canonical YYYY-MM-DD date"));
  }
  // Shape alone accepted verifiedAt AFTER expiresAt — a window that was
  // never open — and a permission granted in 2099.
  if (ISO_DATE.test(study.verifiedAt ?? "") && ISO_DATE.test(study.expiresAt ?? "")) {
    if (study.expiresAt <= study.verifiedAt) {
      errors.push(where("expiresAt must be after verifiedAt — otherwise the window never opened"));
    }
  }
  if (p && ISO_DATE.test(p.grantedAt ?? "") && ISO_DATE.test(study.verifiedAt ?? "")) {
    if (p.grantedAt > study.verifiedAt) {
      errors.push(where("permission grantedAt is after verifiedAt — a grant cannot post-date the case"));
    }
  }

  return errors;
}

export function validateCaseStudies(
  studies: CaseStudy[],
  registry: ProductPublicRecord[],
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const study of studies) {
    if (seen.has(study.slug)) errors.push(`duplicate case-study slug "${study.slug}"`);
    seen.add(study.slug);
    errors.push(...validateCaseStudy(study, registry));
  }
  return errors;
}

/**
 * Cases that may actually appear on the public index.
 *
 * Passing the structural gate is necessary but not sufficient. Two temporal
 * conditions decide whether a case still stands TODAY, and both were
 * previously only described in this comment while the body just re-ran the
 * validator — an independent review deleted the body down to
 * `return studies` and the whole suite stayed green, because the only test
 * fed it an empty array where filtering and not filtering are identical.
 *
 *  1. the case's own verification window is still open;
 *  2. the registry claim its outcome rests on is still verified — a case
 *     may not outlive the claim that gives it its number.
 */
export function publishableCaseStudies(
  studies: CaseStudy[],
  registry: ProductPublicRecord[],
  now: Date = new Date(),
): CaseStudy[] {
  return studies.filter((study) => {
    if (validateCaseStudy(study, registry).length > 0) return false;
    if (study.expiresAt && isExpired(study.expiresAt, now)) return false;
    const claim = registry
      .find((r) => r.slug === study.productSlug)
      ?.claims.find((c) => c.id === study.outcome?.claimId);
    if (!claim) return false;
    if (claim.expiresAt && isExpired(claim.expiresAt, now)) return false;
    return true;
  });
}
