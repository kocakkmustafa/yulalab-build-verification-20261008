/**
 * The privacy notice a lead is agreeing to.
 *
 * Here, in a module with no server dependencies, because BOTH sides need it
 * and they must not disagree: `createLead()` writes this string into
 * `lead_consents.notice_version`, and the form shows the person which notice
 * they are agreeing to. If the displayed date and the recorded one drift,
 * the consent row stops meaning what it says — which is the entire reason
 * consent is a versioned row rather than a boolean.
 *
 * `src/server/leads.ts` cannot own it: it imports `pg`, so a client
 * component that read the constant from there would pull a database driver
 * into the browser bundle.
 *
 * Bump this when the /privacy copy changes in a way that changes what a
 * person is agreeing to. `tests/privacy-claim-anchor.test.ts` and the lead
 * tests anchor the pairing.
 */
export const CURRENT_NOTICE_VERSION = "2026-09-06";
