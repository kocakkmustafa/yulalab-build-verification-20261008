/**
 * Server-owned publication switch for the Studio surface.
 *
 * This deliberately does not use NEXT_PUBLIC_: a client bundle must not
 * decide whether a route and its global CTAs exist. The rollback value is
 * fail-closed; only the exact documented value enables Studio.
 */
export function studioEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.STUDIO_ENABLED === "true";
}
