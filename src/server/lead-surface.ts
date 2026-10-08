/**
 * Whether this deployment is accepting lead submissions.
 *
 * Read by BOTH the API route and the contact page, from one place, because
 * they must never disagree: a page that renders the form while the route
 * answers 503 wastes a person's time, and a route that accepts while the
 * page hides the form means we are collecting personal data from a surface
 * nobody reviewed.
 *
 * Default closed. Not publishing the form does not unpublish the sink —
 * middleware excludes /api, so the route answers on the public internet the
 * moment main deploys — and this switch is what keeps the answer "we are not
 * collecting" until the legal review and mail DNS land.
 *
 * The module refuses to load in a browser. LEADS_ENABLED is not NEXT_PUBLIC,
 * so a client component importing this would read `undefined` and quietly
 * mean "closed" here while the server meant "open" there — the two-answers
 * failure this module exists to prevent, reintroduced by the fix for it.
 * Throwing at load is louder than the `server-only` package and costs no
 * dependency; the package is not installed here and the import resolved at
 * typecheck while failing at runtime, which is the worst of both.
 *
 * Flipping it needs a redeploy, not just an env change: the contact page is
 * prerendered, so it evaluates this once, at build. That is the same
 * render-time trap `scripts/verify-render-mode.mjs` exists for.
 */
if (typeof window !== "undefined") {
  throw new Error("lead-surface is server-only: LEADS_ENABLED is not a public env var");
}

export function leadsEnabled(): boolean {
  return process.env.LEADS_ENABLED === "1";
}
