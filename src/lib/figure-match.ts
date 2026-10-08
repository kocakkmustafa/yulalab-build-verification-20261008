/**
 * The one place that decides whether a registry claim ASSERTS a figure.
 *
 * Extracted after an independent review found the case-study gate had
 * reimplemented this as a substring search and thereby reintroduced three
 * regressions the stat-card guard already had named tests for:
 *   - "~%69" is present in the Burun Farkı claim only to DISCLAIM it, and a
 *     substring match read the disclaimer as a warrant — the exact figure
 *     Y-P0-001 existed to correct;
 *   - "19" was recoverable from the ISO date "2026-08-19" inside the
 *     statement;
 *   - "~%6" and "~%6.1" both matched "~%61" for want of a digit boundary.
 *
 * Two rules, deliberately separate:
 *   assertsFigure()  — a surface may only print a figure the claim DECLARED
 *                      in its structured figures[] array. Exact equality,
 *                      never substring: a disclaimed number, a date, or a
 *                      config constant mentioned in a caveat is not a
 *                      warrant to print it.
 *   figureTokens()   — the digit runs a piece of prose actually shows a
 *                      reader, with dates removed, so a rendered sentence
 *                      can be checked against what was declared.
 */

function normalise(figure: string): string {
  return figure.trim().toLocaleLowerCase("en");
}

/**
 * The registry's OWN string for a figure a case reports.
 *
 * Equality is enforced case-insensitively, so a case may say "aes-256"
 * against a registry "AES-256". Rendering the author's copy made
 * "the numeral you see is read from the registry" true on the detail page
 * and false on the index — one resolver, called from both, is what makes
 * that sentence true everywhere it is claimed.
 */
export function registryFigure(claim: { figures?: string[] } | undefined, value: string): string {
  return (
    claim?.figures?.find((f) => normalise(f) === normalise(value)) ?? value
  );
}

/** Does this claim declare exactly this figure? */
export function assertsFigure(claim: { figures?: string[] }, value: string): boolean {
  return (claim.figures ?? []).some((f) => normalise(f) === normalise(value));
}

/**
 * Strip ISO dates before looking at digits — every claim carries one, and a
 * date is not a measurement.
 */
export function withoutDates(text: string): string {
  return (
    text
      .replace(/\p{Nd}{4}-\p{Nd}{2}-\p{Nd}{2}/gu, " ")
      // A standalone year is a date reference too. "The 2026 rebuild" was
      // refused as a stated figure until this was added — a guard firing on
      // an ordinary sentence is one somebody turns off. Scoped to 1900-2099
      // so an arbitrary four-digit quantity is still a quantity.
      .replace(/(?<![\p{Nd}])(?:19|20)\p{Nd}{2}(?![\p{Nd}])/gu, " ")
  );
}

/**
 * Digit runs a reader would see as numbers in this text, dates excluded.
 * Used to check that a rendered sentence shows no figure nobody declared.
 */
export function figureTokens(text: string): string[] {
  const matches = withoutDates(text).match(/\p{Nd}+(?:[.,]\p{Nd}+)*/gu) ?? [];
  return matches.map((m) => m.replace(/[., ]/g, ""));
}

/**
 * Digit runs including ISO dates — for LABEL fields, where a date is not
 * context but a number the registry never supplied. Measured: a metric of
 * "Top-3 accuracy on 2026-08-19" rendered a verification date that was not
 * the claim's, because the prose-oriented scan strips dates by design.
 */
export function figureTokensWithDates(text: string): string[] {
  const matches = text.match(/\p{Nd}+(?:[.,]\p{Nd}+)*/gu) ?? [];
  return matches.map((m) => m.replace(/[., ]/g, ""));
}

/** Digits of a declared figure, for comparing against figureTokens(). */
export function figureDigits(figure: string): string {
  return figure.replace(/\P{Nd}/gu, "");
}

/**
 * Spelled-out magnitudes. A digit scan cannot see "ninety-five percent" or
 * "revenue tripled", so a rule that only counts digits is trivially evaded
 * by writing the number in words — an independent review demonstrated
 * exactly that. The outcome sentence is one sentence: any real figure can be
 * written as a numeral, and a magnitude that refuses to be is not checkable.
 */
const SPELLED_MAGNITUDES: Record<"tr" | "en", string[]> = {
  /**
   * Applied to the outcome METRIC only — a short, digit-free label — not to
   * free prose. That scope is what makes a word list defensible here: the
   * composed outcome takes its numeral from the registry, so this guard only
   * has to stop a label from smuggling in a quantity of its own
   * ("revenue tripled" as a metric name).
   *
   * Still pruned of everything that doubles as an ordinary word, because a
   * guard that fires on honest input gets switched off. Removed after review:
   * "bir"/"one" (indefinite article), "on" (=10, and an English
   * preposition), "yüz" (=100, and "face"), "altı" (=6, and "bottom"),
   * "yedi" (=7, and "consumed"), "double" (as in "double-blind").
   */
  en: [
    "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty",
    "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand",
    "million", "billion", "dozen",
    "doubled", "doubling", "triple", "tripled", "tripling", "quadrupled",
    "halved", "tenfold", "twofold", "threefold", "percent", "percentage",
  ],
  tr: [
    "iki", "üç", "dört", "beş", "sekiz", "dokuz",
    "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen",
    "doksan", "bin", "milyon", "milyar", "düzine",
    "katlandı", "katına", "katıyla", "çeyrek", "yarıya", "yüzde",
  ],
};

/**
 * Multi-word magnitude phrases, matched literally. A single-token list
 * cannot see "cut in half", "by a third" or "order of magnitude".
 */
const PHRASES: Record<"tr" | "en", string[]> = {
  en: ["in half", "by a third", "by a quarter", "order of magnitude", "an order of"],
  tr: ["üçte bir", "onda bir", "yarısına", "kat kat"],
};

export function spelledMagnitudes(text: string, lang: "tr" | "en"): string[] {
  const found: string[] = [];
  for (const word of SPELLED_MAGNITUDES[lang]) {
    // Whole word, BOTH boundaries. A leading-only boundary made the "onda"
    // stem fire on "ondan sonra" and "Ondalık" — ordinary Turkish prose.
    const re = new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "iu");
    if (re.test(text)) found.push(word);
  }
  for (const phrase of PHRASES[lang]) {
    if (text.toLocaleLowerCase(lang === "tr" ? "tr" : "en").includes(phrase)) found.push(phrase);
  }
  return found;
}

/**
 * Label-shaped tokens: a word joined to digits by a hyphen or underscore —
 * "Top-3", "AES-256", "R-69". No whitespace, no percent sign.
 *
 * A metric label legitimately needs these ("Top-3 accuracy"), so they are cut
 * out before the metric is scanned for quantities. The shape is the whole
 * constraint: it admits an identifier and rejects a measurement, since
 * "95%", "95" and "rose to 95" are none of them label-shaped.
 *
 * Residual, stated rather than hidden: "Accuracy-95" IS label-shaped. It
 * reads as an identifier beside a registry-sourced figure rather than as a
 * second measurement, which is the trade this shape buys.
 */
// The negative lookahead spans optional whitespace: guarding only an
// ADJACENT percent sign let "accuracy-95 %" and "accuracy-95 percent" strip
// clean and render as a percentage beside the registry figure — past the
// stated residual, which covers identifier-shaped labels, not measurements
// with a space in them.
const LABEL_TOKEN = /(?<![\p{L}\p{Nd}])\p{L}[\p{L}\p{Nd}]*[-_]\p{Nd}+(?![\p{L}\p{Nd}]|\s*%)/gu;

export function stripLabelTokens(text: string): string {
  return text.replace(LABEL_TOKEN, " ");
}
