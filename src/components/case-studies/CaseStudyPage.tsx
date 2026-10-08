import { useLocale } from "next-intl";
import type { CaseStudy } from "@/lib/case-studies";
import { registryFigure } from "@/lib/figure-match";
import { SITE_TIME_ZONE } from "@/lib/public-registry";
import type { Locale, ProductPublicRecord } from "@/lib/types";

/**
 * A published case study. Every section here is mandatory upstream
 * (src/lib/case-studies.ts), so this component never has to decide whether
 * to hide a missing piece — an incomplete case cannot reach it.
 *
 * The permission line renders BEFORE the outcome deliberately: a reader
 * should know whose story this is, and on what authority it is being told,
 * before they read the number it ends on.
 */
export function CaseStudyPage({
  study,
  claim,
}: {
  study: CaseStudy;
  /**
   * The registry claim the outcome is composed from. REQUIRED, not optional:
   * publishableCaseStudies already refuses a case whose claim is missing or
   * lapsed, so an optional prop only bought a silent degradation path — a
   * bare figure with no statement and no verifiedAt — if the two lookups
   * ever diverged. Let the type prove it instead.
   */
  claim: ProductPublicRecord["claims"][number];
}) {
  const locale = useLocale() as Locale;
  const tr = locale === "tr";
  const pick = (a: string, b: string) => (tr ? a : b);

  return (
    <article className="mx-auto max-w-3xl px-6 pb-24 pt-32 lg:px-10 lg:pt-40">
      <h1 className="font-display text-[40px] font-extrabold leading-[0.96] tracking-tightest text-ink-50 sm:text-[56px]">
        {pick(study.titleTr, study.titleEn)}
      </h1>

      {/* Provenance strip — who authorised this, how far it goes, and when
          the whole thing needs re-checking. */}
      <div className="mt-7 rounded-2xl border border-hairline bg-surface-inset p-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-400">
          {tr ? "İzin ve kapsam" : "Permission and scope"}
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-200">
          {study.permission.kind === "self-owned"
            ? tr
              ? "YULA'nın kendi ürünü — bu vaka kendi işimizi anlatıyor."
              : "A YULA-owned product — this case describes our own work."
            : tr
              ? `Yazılı izin: ${study.permission.grantedBy} (${study.permission.grantedAt})`
              : `Written permission: ${study.permission.grantedBy} (${study.permission.grantedAt})`}
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-300">
          {pick(study.permission.scopeTr, study.permission.scopeEn)}
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
          {tr ? "doğrulandı" : "verified"} {study.verifiedAt} ·{" "}
          {tr ? "geçerlilik" : "valid until"} {study.expiresAt}
        </p>
      </div>

      <Section title={tr ? "Başlangıç durumu" : "Baseline"}>
        {pick(study.baselineTr, study.baselineEn)}
      </Section>
      <Section title={tr ? "Kısıt" : "Constraint"}>
        {pick(study.constraintTr, study.constraintEn)}
      </Section>

      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink-50">
          {tr ? "Karar kaydı" : "Decision log"}
        </h2>
        <ol className="mt-4 space-y-4">
          {study.decisions.map((d, i) => (
            <li key={i} className="border-l border-hairline pl-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-400">
                {/* SITE_TIME_ZONE, not the server's: formatting a UTC
                    midnight in a western zone rendered the previous day —
                    the same off-by-one src/lib/public-registry.ts documents.
                    The day is kept; a decision log without days is a diary
                    of months. */}
                {new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
                  timeZone: SITE_TIME_ZONE,
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }).format(new Date(`${d.date}T12:00:00Z`))}
              </div>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-200">
                {pick(d.summaryTr, d.summaryEn)}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink-50">
          {tr ? "Artefaktlar" : "Artifacts"}
        </h2>
        <ul className="mt-4 space-y-2">
          {study.artifacts.map((a) => (
            <li key={a.source} className="flex flex-wrap items-baseline gap-3">
              <span className="rounded-full border border-hairline px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-300">
                {a.kind}
              </span>
              <span className="text-[15px] text-ink-200">{pick(a.labelTr, a.labelEn)}</span>
              <code className="font-mono text-[11px] text-ink-400">{a.source}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 rounded-2xl border border-hairline bg-surface p-6">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink-50">
          {tr ? "Ölçülen sonuç" : "Measured outcome"}
        </h2>
        {/* Composed: the label is the case's, the NUMERAL is the registry's.
            No sentence the author typed can put a figure on this page. */}
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <span className="text-[16px] leading-relaxed text-ink-200">
            {pick(study.outcome.metricTr, study.outcome.metricEn)}
          </span>
          <span className="font-display text-3xl font-bold text-ink-50">
            {/* The REGISTRY's own string, via the shared resolver. */}
            {registryFigure(claim, study.outcome.figure)}
          </span>
        </div>
        <p className="mt-4 border-l border-hairline pl-4 text-[14px] leading-relaxed text-ink-300">
          {pick(claim.statementTr, claim.statementEn)}
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
          {tr ? "kaynak iddia" : "source claim"}: {study.outcome.claimId}
          {` · ${tr ? "doğrulandı" : "verified"} ${claim.verifiedAt}`}
        </p>
      </div>

      {/* Mandatory, and placed with the same weight as the outcome: a case
          study that only reports what worked is an advertisement. */}
      <Section title={tr ? "Ne başarısız oldu" : "What failed"}>
        {pick(study.failureTr, study.failureEn)}
      </Section>
      <Section title={tr ? "Sonrasında ne değişti" : "What changed after"}>
        {pick(study.changedAfterTr, study.changedAfterEn)}
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink-50">{title}</h2>
      <p className="mt-3 text-[15.5px] leading-relaxed text-ink-300">{children}</p>
    </div>
  );
}
