import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyDataRequestChallenge } from "@/server/data-request-challenge";

const ENV_KEYS = [
  "DATA_REQUEST_CHALLENGE_PROVIDER",
  "DATA_REQUEST_CHALLENGE_SECRET",
  "DATA_REQUEST_CHALLENGE_HOSTNAME",
] as const;

beforeEach(() => {
  process.env.DATA_REQUEST_CHALLENGE_PROVIDER = "turnstile";
  process.env.DATA_REQUEST_CHALLENGE_SECRET = "server-only-test-secret";
  process.env.DATA_REQUEST_CHALLENGE_HOSTNAME = "yulalab.com";
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.restoreAllMocks();
});

function provider(payload: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("the durable-admission challenge", () => {
  it("accepts only a provider-verified token for the exact action and hostname", async () => {
    const fetchImpl = provider({ success: true, action: "data-request", hostname: "yulalab.com" });

    await expect(
      verifyDataRequestChallenge("valid-provider-token", { fetchImpl, timeoutMs: 50 }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    const submitted = new URLSearchParams((init as RequestInit).body as string);
    expect(submitted.get("secret")).toBe("server-only-test-secret");
    expect(submitted.get("response")).toBe("valid-provider-token");
    expect([...submitted.keys()].sort()).toEqual(["response", "secret"]);
  });

  it.each([
    [{ success: false, action: "data-request", hostname: "yulalab.com" }, "invalid"],
    [{ success: true, action: "other", hostname: "yulalab.com" }, "invalid"],
    [{ success: true, action: "data-request", hostname: "www.yulalab.com" }, "invalid"],
  ] as const)("rejects a provider response outside the exact contract", async (payload, reason) => {
    await expect(
      verifyDataRequestChallenge("valid-provider-token", {
        fetchImpl: provider(payload),
        timeoutMs: 50,
      }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it("fails closed without complete server configuration and never calls the provider", async () => {
    const fetchImpl = provider({ success: true, action: "data-request", hostname: "yulalab.com" });
    delete process.env.DATA_REQUEST_CHALLENGE_SECRET;
    await expect(
      verifyDataRequestChallenge("valid-provider-token", { fetchImpl, timeoutMs: 50 }),
    ).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["", " ", "x".repeat(2049)])("rejects malformed or oversized tokens", async (token) => {
    const fetchImpl = provider({ success: true, action: "data-request", hostname: "yulalab.com" });
    await expect(
      verifyDataRequestChallenge(token, { fetchImpl, timeoutMs: 50 }),
    ).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["non-2xx", provider({ success: true }, 503)],
    ["malformed JSON", vi.fn(async () => new Response("not-json", { status: 200 })) as unknown as typeof fetch],
    ["network error", vi.fn(async () => { throw new Error("provider offline"); }) as unknown as typeof fetch],
  ])("fails closed on %s without exposing provider detail", async (_label, fetchImpl) => {
    await expect(
      verifyDataRequestChallenge("valid-provider-token", { fetchImpl, timeoutMs: 50 }),
    ).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("bounds a provider that never answers", async () => {
    const hangs = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    await expect(
      verifyDataRequestChallenge("valid-provider-token", { fetchImpl: hangs, timeoutMs: 10 }),
    ).resolves.toEqual({ ok: false, reason: "unavailable" });
  });
});
