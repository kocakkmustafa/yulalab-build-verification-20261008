"use client";

import { useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics/client";
import {
  STUDIO_QUALIFIERS,
  qualificationSummary,
  validateStudioApplication,
  type StudioApplication,
  type StudioErrorCode,
} from "@/lib/studio";

/**
 * The studio application.
 *
 * Rides the existing lead pipeline (`intent: "studio"`, which the schema and
 * the router already know) rather than opening a second channel: one place
 * that stores personal data, one retention rule, one deletion path, one
 * privacy text describing all of it. Behind the same switch as every other
 * form, so the page can be read while the site is not yet collecting.
 *
 * EVERY reader-facing string lives in messages/*.json. Not style: an
 * independent review put a funding promise into ~20 strings that were still
 * inline here and the claim scanner could not see any of them. Copy in a
 * component is copy nothing checks.
 */
export function StudioApplicationForm({ open }: { open: boolean }) {
  const t = useTranslations("studio.form");
  const locale = useLocale() as "tr" | "en";
  const id = useId();

  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorCodes, setErrorCodes] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const started = useRef(false);

  /** Fired once, on first real interaction — not on render. */
  function markStarted() {
    if (started.current) return;
    started.current = true;
    track({ event: "studio_application_started" });
  }

  if (!open) {
    // The closed branch is a real branch, not an absence: it states what is
    // true right now and gives the reader a working alternative.
    return (
      <div className="rounded-2xl border border-hairline bg-surface-inset p-6">
        <h3 className="font-display text-base font-semibold text-ink-50">{t("closedTitle")}</h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-300">{t("closedBody")}</p>
        <p className="mt-4 text-[14.5px] leading-relaxed text-ink-200">
          {t("closedAlt")}
          <Link href="/contact" className="link-wipe text-ink-100">
            {t("closedAltLink")}
          </Link>
        </p>
      </div>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    // Client-side consent enforcement: the form uses noValidate, so `required`
    // would enforce nothing.
    if (!consent) {
      setErrorCodes(["consent"]);
      setState("error");
      return;
    }

    const application: StudioApplication = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      company: String(form.get("company") ?? "") || undefined,
      problem: String(form.get("problem") ?? ""),
      budgetBand: String(form.get("budgetBand") ?? "") as StudioApplication["budgetBand"],
      timing: String(form.get("timing") ?? "") as StudioApplication["timing"],
      decisionRole: String(form.get("decisionRole") ?? "") as StudioApplication["decisionRole"],
      locale,
    };

    // Compose FIRST, then check what actually goes on the wire: the route
    // caps `message`, and a maximal problem plus the qualification summary
    // exceeded it while the visitor saw only "could not send".
    const message = `${qualificationSummary(application, locale)}\n\n${application.problem}`;
    const problems = validateStudioApplication(application, { composedMessage: message });
    if (problems.length) {
      setErrorCodes(problems);
      setState("error");
      return;
    }

    setState("sending");
    setErrorCodes([]);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: application.name,
          email: application.email,
          company: application.company,
          intent: "studio",
          message,
          locale,
          // The server validates these closed enums and derives the routing
          // verdict. A browser can describe answers, never mint a verdict.
          budgetBand: application.budgetBand,
          timing: application.timing,
          decisionRole: application.decisionRole,
          // Read from the form, never hardcoded: both were literals, which
          // made the honeypot inert and made the consent record say "agreed"
          // regardless of the box.
          consent,
          website: String(form.get("website") ?? ""),
        }),
      });
      if (!response.ok) {
        // The route's own reason, mapped to localized copy — the sibling
        // form does this and the first version collapsed 400/429/503 into
        // one sentence, so a person hitting the closed sink was told only
        // that something failed.
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorCodes([studioErrorKey(body.error, response.status)]);
        setState("error");
        return;
      }
      const body = (await response.json()) as { receiptId?: string };
      setReceipt(body.receiptId ?? null);
      setState("sent");
      // Anonymous telemetry keeps only the accepted-submission denominator.
      // The qualified numerator is the server-bound `studio-qualified`
      // internal-route record written atomically with the lead.
      track({ event: "studio_application_submitted" });
    } catch {
      setErrorCodes(["server"]);
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-hairline bg-surface p-6">
        <h3 className="font-display text-base font-semibold text-ink-50">{t("sentTitle")}</h3>
        {receipt ? (
          <p className="mt-3 font-mono text-[12px] text-ink-300">
            {t("reference")}: {receipt}
          </p>
        ) : null}
      </div>
    );
  }

  const field = "w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-[15px] text-ink-100";
  const label = "block font-mono text-[10px] uppercase tracking-widest text-ink-400";
  // Deduped: a long problem tripped both length branches, so the reader saw
  // the same sentence twice and React saw duplicate keys.
  const shown = Array.from(new Set(errorCodes));

  return (
    <form noValidate onSubmit={submit} onFocusCapture={markStarted} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`${id}-name`}>
            {t("name")}
          </label>
          <input id={`${id}-name`} name="name" className={`mt-2 ${field}`} autoComplete="name" />
        </div>
        <div>
          <label className={label} htmlFor={`${id}-email`}>
            {t("email")}
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            className={`mt-2 ${field}`}
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor={`${id}-company`}>
          {t("company")}
        </label>
        <input
          id={`${id}-company`}
          name="company"
          className={`mt-2 ${field}`}
          autoComplete="organization"
        />
      </div>

      {/* Closed choices: a band cannot hold an exact figure, a role cannot
          hold a third party's name. */}
      {STUDIO_QUALIFIERS.map((q) => (
        <div key={q.id}>
          <label className={label} htmlFor={`${id}-${q.id}`}>
            {locale === "tr" ? q.labelTr : q.labelEn}
          </label>
          <select id={`${id}-${q.id}`} name={q.id} className={`mt-2 ${field}`} defaultValue="">
            <option value="" disabled>
              {t("choose")}
            </option>
            {q.options.map((option) => (
              <option key={option.value} value={option.value}>
                {locale === "tr" ? option.labelTr : option.labelEn}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div>
        <label className={label} htmlFor={`${id}-problem`}>
          {t("problem")}
        </label>
        <textarea id={`${id}-problem`} name="problem" rows={5} className={`mt-2 ${field}`} />
      </div>

      {/* Honeypot. Positioned off-screen rather than hidden by a class an
          edit could drop — a review of the sibling form found one that had
          become a visible "Website" input silently discarding real messages. */}
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>

      <label className="flex items-start gap-3 text-[13.5px] leading-relaxed text-ink-300">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span>
          {t("consent")}{" "}
          <Link href="/privacy" className="link-wipe text-ink-200">
            {t("consentLink")}
          </Link>
        </span>
      </label>

      {shown.length > 0 ? (
        <ul
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-hairline bg-surface-inset p-4 text-[13.5px] text-ink-200"
        >
          {shown.map((code) => (
            <li key={code}>{t(`errors.${code}`)}</li>
          ))}
        </ul>
      ) : null}

      <button
        type="submit"
        disabled={state === "sending"}
        className="focusable rounded-full border border-hairline-strong px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-50 disabled:opacity-60"
      >
        {state === "sending" ? t("sending") : t("submit")}
      </button>
    </form>
  );
}

/** The route's error envelope, mapped to an error key this form has copy for. */
export function studioErrorKey(
  error: string | undefined,
  status: number,
): StudioErrorCode | "rate" | "closed" | "server" {
  if (status === 429) return "rate";
  if (status === 503) return "closed";
  switch (error) {
    case "name":
    case "email":
    case "company":
      return error === "company" ? "company-long" : (error as StudioErrorCode);
    case "message":
      return "problem-long";
    case "not_accepting_submissions":
    case "studio_not_accepting_submissions":
      return "closed";
    default:
      return "server";
  }
}
