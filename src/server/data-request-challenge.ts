const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2_048;

export type ChallengeResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "unavailable" };

type ProviderResponse = {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
};

/**
 * Verify proof-of-humanity before any database connection is acquired.
 *
 * The result deliberately carries no provider detail: callers need only know
 * whether to reject the proof or fail the surface closed. Tokens and request
 * fields never enter logs in this boundary.
 */
export async function verifyDataRequestChallenge(
  token: unknown,
  {
    fetchImpl = fetch,
    timeoutMs = 3_000,
  }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ChallengeResult> {
  if (typeof token !== "string" || token.trim().length < 1 || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: "invalid" };
  }

  const provider = process.env.DATA_REQUEST_CHALLENGE_PROVIDER;
  const secret = process.env.DATA_REQUEST_CHALLENGE_SECRET;
  const hostname = process.env.DATA_REQUEST_CHALLENGE_HOSTNAME;
  if (provider !== "turnstile" || !secret?.trim() || !hostname?.trim()) {
    return { ok: false, reason: "unavailable" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = new URLSearchParams({ secret: secret.trim(), response: token.trim() });
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };

    let payload: ProviderResponse;
    try {
      payload = (await response.json()) as ProviderResponse;
    } catch {
      return { ok: false, reason: "unavailable" };
    }
    if (
      payload.success !== true ||
      payload.action !== "data-request" ||
      payload.hostname !== hostname.trim()
    ) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
