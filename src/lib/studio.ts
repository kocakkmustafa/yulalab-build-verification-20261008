/**
 * The studio engagement application (roadmap Y-P1-004).
 *
 * Two constraints shape this file, both of them mechanical rather than
 * editorial:
 *
 * 1. QUALIFICATION IS AN ENUM, NEVER FREE TEXT. Budget, timing and decision
 *    authority are the questions that decide whether a conversation is worth
 *    both sides' time — and also the ones where a free field would collect
 *    commercially sensitive detail we have no use for. Bands cannot hold an
 *    exact revenue figure, and a role cannot hold a third party's name.
 *
 * 2. THE ONLY FREE FIELD IS THE APPLICANT'S OWN PROBLEM. That is what we
 *    actually need to read; everything else is a closed choice, which also
 *    means the receipt and routing can be composed from known values rather
 *    than from a stranger's prose.
 */

export type BudgetBand = "under-50k" | "50-150k" | "150-400k" | "over-400k" | "unsure";
export type Timing = "now" | "1-3-months" | "3-6-months" | "exploring";
export type DecisionRole = "founder" | "exec" | "product-lead" | "advisor" | "other";

export type StudioApplication = {
  name: string;
  email: string;
  company?: string;
  /** The one free field: what they are actually trying to solve. */
  problem: string;
  budgetBand: BudgetBand;
  timing: Timing;
  /** The applicant's own role in the decision — never a named third party. */
  decisionRole: DecisionRole;
  locale: "tr" | "en";
};

export type Qualifier = {
  id: "budgetBand" | "timing" | "decisionRole";
  labelTr: string;
  labelEn: string;
  options: { value: string; labelTr: string; labelEn: string }[];
};

/**
 * Bands are deliberately coarse and currency-free.
 *
 * Coarse, because the answer only has to sort "is this a project or a
 * conversation"; currency-free, because a figure here would be a commercial
 * term, and commercial terms are the founder's to state (roadmap R3).
 */
export const STUDIO_QUALIFIERS: Qualifier[] = [
  {
    id: "budgetBand",
    labelTr: "Ayrılan bütçe aralığı",
    labelEn: "Budget band",
    options: [
      { value: "under-50k", labelTr: "Henüz küçük bir bütçe", labelEn: "A small budget so far" },
      { value: "50-150k", labelTr: "Orta ölçekli bir proje bütçesi", labelEn: "A mid-sized project budget" },
      { value: "150-400k", labelTr: "Tam bir ürün programı bütçesi", labelEn: "A full product-programme budget" },
      { value: "over-400k", labelTr: "Çok dönemli bir program bütçesi", labelEn: "A multi-phase programme budget" },
      { value: "unsure", labelTr: "Henüz belirlenmedi", labelEn: "Not decided yet" },
    ],
  },
  {
    id: "timing",
    labelTr: "Başlama zamanı",
    labelEn: "Timing",
    options: [
      { value: "now", labelTr: "Hazırız", labelEn: "Ready now" },
      { value: "1-3-months", labelTr: "1-3 ay içinde", labelEn: "In 1-3 months" },
      { value: "3-6-months", labelTr: "3-6 ay içinde", labelEn: "In 3-6 months" },
      { value: "exploring", labelTr: "Araştırma aşamasında", labelEn: "Still exploring" },
    ],
  },
  {
    id: "decisionRole",
    labelTr: "Bu kararı veren rol",
    labelEn: "Who decides",
    options: [
      { value: "founder", labelTr: "Kurucu", labelEn: "Founder" },
      { value: "exec", labelTr: "Yönetici", labelEn: "Executive" },
      { value: "product-lead", labelTr: "Ürün lideri", labelEn: "Product lead" },
      { value: "advisor", labelTr: "Danışman", labelEn: "Advisor" },
      { value: "other", labelTr: "Diğer", labelEn: "Other" },
    ],
  },
];

function optionsFor(id: Qualifier["id"]): string[] {
  return STUDIO_QUALIFIERS.find((q) => q.id === id)!.options.map((o) => o.value);
}

export function isBudgetBand(value: unknown): value is BudgetBand {
  return typeof value === "string" && optionsFor("budgetBand").includes(value);
}

export function isTiming(value: unknown): value is Timing {
  return typeof value === "string" && optionsFor("timing").includes(value);
}

export function isDecisionRole(value: unknown): value is DecisionRole {
  return typeof value === "string" && optionsFor("decisionRole").includes(value);
}

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/**
 * The route's own limits, restated so the client cannot promise something
 * the server will refuse. They were 4000 for `problem` here and 4000 for the
 * COMPOSED message there — so a maximal problem plus the qualification
 * summary was rejected server-side and the visitor saw only "could not
 * send".
 */
export const LIMITS = { name: 120, email: 254, company: 160, message: 4000 } as const;

/**
 * Error CODES, not sentences.
 *
 * The first version returned English strings that interpolated the submitted
 * value, and the form rendered them to Turkish readers — against the route's
 * own doctrine that a validation error names the FIELD, never the value.
 */
export type StudioErrorCode =
  | "name"
  | "name-long"
  | "email"
  | "email-long"
  | "problem"
  | "problem-long"
  | "company-long"
  | "budgetBand"
  | "timing"
  | "decisionRole"
  | "locale";

export function validateStudioApplication(
  application: StudioApplication,
  options?: { composedMessage?: string },
): StudioErrorCode[] {
  const errors: StudioErrorCode[] = [];

  if (!application.name?.trim()) errors.push("name");
  else if (application.name.trim().length > LIMITS.name) errors.push("name-long");

  if (!application.email?.trim()) errors.push("email");
  else if (!EMAIL.test(application.email.trim())) errors.push("email");
  else if (application.email.trim().length > LIMITS.email) errors.push("email-long");

  if (!application.problem?.trim()) errors.push("problem");
  else if (application.problem.trim().length > LIMITS.message) errors.push("problem-long");

  // What actually goes on the wire is the composed message, so that is what
  // the length check must measure when the caller can supply it.
  if (options?.composedMessage && options.composedMessage.length > LIMITS.message) {
    errors.push("problem-long");
  }

  if (application.company && application.company.length > LIMITS.company) {
    errors.push("company-long");
  }

  // Closed choices. A value outside the offered set is not "unknown", it is
  // a field the form did not produce.
  if (!isBudgetBand(application.budgetBand)) errors.push("budgetBand");
  if (!isTiming(application.timing)) errors.push("timing");
  if (!isDecisionRole(application.decisionRole)) errors.push("decisionRole");
  if (application.locale !== "tr" && application.locale !== "en") errors.push("locale");

  // De-duplicated at the source: a long problem tripped both the field
  // check and the composed-message check, so the reader saw the same
  // sentence twice and React saw duplicate keys.
  return [...new Set(errors)];
}

/**
 * The qualification, rendered for the lead message.
 *
 * Composed from the declared option values — the same discipline the case
 * studies ended up at: nothing here is a sentence somebody typed, so nothing
 * here can say something the form did not collect.
 */
export function qualificationSummary(
  application: StudioApplication,
  locale: "tr" | "en",
): string {
  const line = (id: Qualifier["id"], value: string) => {
    const q = STUDIO_QUALIFIERS.find((x) => x.id === id)!;
    const label = locale === "tr" ? q.labelTr : q.labelEn;
    const option = q.options.find((o) => o.value === value);
    // The LABEL the applicant actually saw, not the enum value. The stored
    // record used to read "Ayrılan bütçe aralığı: 50-150k" — a numeric band,
    // in an unstated currency, attributed to someone who was shown no figure
    // at all. On this site of all sites, the record has to match what the
    // person was asked.
    const shown = option ? (locale === "tr" ? option.labelTr : option.labelEn) : value;
    return `${label}: ${shown}`;
  };
  return [
    line("budgetBand", application.budgetBand),
    line("timing", application.timing),
    line("decisionRole", application.decisionRole),
  ].join("\n");
}
