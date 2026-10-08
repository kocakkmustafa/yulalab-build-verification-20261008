import { describe, expect, it } from "vitest";
import { rotatingSessionHash, purgeAtFor, RAW_RETENTION_DAYS } from "@/lib/analytics/session-hash";

const SECRET = "test-secret-not-a-real-one";
const TOKEN = "a".repeat(32);

describe("rotating session hash", () => {
  it("groups the same visitor's events within one day", () => {
    const a = rotatingSessionHash(TOKEN, new Date("2026-08-19T01:00:00Z"), SECRET);
    const b = rotatingSessionHash(TOKEN, new Date("2026-08-19T23:00:00Z"), SECRET);
    expect(a).toBe(b);
  });

  it("actually rotates across days", () => {
    // This is the whole point of "rotating": if it did not change, one
    // pseudonym would follow a visitor forever and the table would be a
    // long-lived identifier store, not an attribution log.
    const day1 = rotatingSessionHash(TOKEN, new Date("2026-08-19T23:59:59Z"), SECRET);
    const day2 = rotatingSessionHash(TOKEN, new Date("2026-08-20T00:00:01Z"), SECRET);
    expect(day1).not.toBe(day2);
  });

  it("separates two visitors on the same day", () => {
    const a = rotatingSessionHash("a".repeat(32), new Date("2026-08-19T10:00:00Z"), SECRET);
    const b = rotatingSessionHash("b".repeat(32), new Date("2026-08-19T10:00:00Z"), SECRET);
    expect(a).not.toBe(b);
  });

  it("never leaks the raw token into the stored value", () => {
    const hash = rotatingSessionHash(TOKEN, new Date("2026-08-19T10:00:00Z"), SECRET);
    expect(hash).not.toContain(TOKEN);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cannot be matched by enumerating tokens without the secret", () => {
    // The earlier version of this test only checked that two secrets give
    // two digests — that proves the secret is an input, not that the hash
    // resists an attacker. This one plays the attacker: it has the stored
    // hash and the full candidate token space, but no secret.
    const day = new Date("2026-08-19T10:00:00Z");
    const stored = rotatingSessionHash(TOKEN, day, SECRET);

    const candidates = [TOKEN, "b".repeat(32), "c".repeat(32), "0".repeat(32)];
    const guessedSecrets = ["", "secret", "yula", "changeme", "other-secret"];
    for (const candidate of candidates) {
      for (const guess of guessedSecrets) {
        if (!guess) continue; // an empty secret throws, tested separately
        expect(rotatingSessionHash(candidate, day, guess)).not.toBe(stored);
      }
    }
    // With the secret, the very first candidate matches — proving the loop
    // above fails for the right reason (the key), not because the helper is
    // broken.
    expect(rotatingSessionHash(TOKEN, day, SECRET)).toBe(stored);
  });

  it("throws rather than falling back to a constant when the secret is missing", () => {
    // A silent fallback would produce a stable, joinable hash forever —
    // the exact privacy failure the rotation exists to prevent. Failing
    // closed here is why the API route reports storage as unavailable
    // instead of writing a weaker pseudonym.
    expect(() => rotatingSessionHash(TOKEN, new Date(), "")).toThrow(/secret/i);
    expect(() => rotatingSessionHash(TOKEN, new Date(), undefined as unknown as string)).toThrow();
  });
});

describe("raw retention", () => {
  it("keeps raw attribution rows for 30 days (roadmap §7.2)", () => {
    expect(RAW_RETENTION_DAYS).toBe(30);
  });

  it("computes purge_at exactly 30 days after creation", () => {
    const created = new Date("2026-08-19T10:00:00Z");
    expect(purgeAtFor(created).toISOString()).toBe("2026-09-18T10:00:00.000Z");
  });
});
