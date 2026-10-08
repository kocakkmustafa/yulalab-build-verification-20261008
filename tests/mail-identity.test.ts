import { describe, expect, it } from "vitest";
import {
  APPROVED_MAIL_IDENTITY,
  MAIL_IDENTITY_ENV,
  mailIdentityDiagnosticCodes,
  resolveMailIdentity,
  type MailIdentityEnvironment,
} from "@/server/mail-identity";

const EXACT_ENV: MailIdentityEnvironment = {
  [MAIL_IDENTITY_ENV.fromEmail]: APPROVED_MAIL_IDENTITY.fromEmail,
  [MAIL_IDENTITY_ENV.fromName]: APPROVED_MAIL_IDENTITY.fromName,
  [MAIL_IDENTITY_ENV.replyToEmail]: APPROVED_MAIL_IDENTITY.replyToEmail,
  [MAIL_IDENTITY_ENV.internalAddress]: APPROVED_MAIL_IDENTITY.internalAddress,
};

const EXPECTED_BY_KEY = {
  [MAIL_IDENTITY_ENV.fromEmail]: APPROVED_MAIL_IDENTITY.fromEmail,
  [MAIL_IDENTITY_ENV.fromName]: APPROVED_MAIL_IDENTITY.fromName,
  [MAIL_IDENTITY_ENV.replyToEmail]: APPROVED_MAIL_IDENTITY.replyToEmail,
  [MAIL_IDENTITY_ENV.internalAddress]: APPROVED_MAIL_IDENTITY.internalAddress,
} as const;

function without(key: keyof typeof EXPECTED_BY_KEY): MailIdentityEnvironment {
  const env = { ...EXACT_ENV };
  delete env[key];
  return env;
}

function withValue(key: keyof typeof EXPECTED_BY_KEY, value: string): MailIdentityEnvironment {
  return { ...EXACT_ENV, [key]: value };
}

describe("YULALAB mail identity", () => {
  it("resolves the exact approved base identity and internal address", () => {
    const resolved = resolveMailIdentity(EXACT_ENV);

    expect(resolved.transport).toEqual({
      ready: true,
      value: {
        fromEmail: "hello@yulalab.com",
        fromName: "YULALAB",
        replyToEmail: "yula@yulalab.com",
      },
      missing: [],
      invalid: [],
    });
    expect(resolved.internalRoute).toEqual({
      ready: true,
      value: { address: "yula@yulalab.com" },
      missing: [],
      invalid: [],
    });
  });

  for (const key of Object.keys(EXPECTED_BY_KEY) as Array<keyof typeof EXPECTED_BY_KEY>) {
    const scope = key === MAIL_IDENTITY_ENV.internalAddress ? "internalRoute" : "transport";

    it(`reports ${key} as missing without exposing a value`, () => {
      const result = resolveMailIdentity(without(key))[scope];
      expect(result.ready).toBe(false);
      expect(result.missing).toEqual([key]);
      expect(result.invalid).toEqual([]);
      expect(mailIdentityDiagnosticCodes(result)).toEqual([key]);
      expect(JSON.stringify(result)).not.toContain(EXPECTED_BY_KEY[key]);
    });

    for (const [label, value] of [
      ["a different value", key === MAIL_IDENTITY_ENV.fromName ? "Yula Lab" : "wrong@example.net"],
      ["leading whitespace", ` ${EXPECTED_BY_KEY[key]}`],
      ["trailing whitespace", `${EXPECTED_BY_KEY[key]} `],
      ["CR", `${EXPECTED_BY_KEY[key]}\r`],
      ["LF", `${EXPECTED_BY_KEY[key]}\n`],
      ["NUL", `${EXPECTED_BY_KEY[key]}\0`],
      ["another control character", `${EXPECTED_BY_KEY[key]}\u001f`],
    ] as const) {
      it(`rejects ${label} in ${key} without echoing it`, () => {
        const result = resolveMailIdentity(withValue(key, value))[scope];
        expect(result.ready).toBe(false);
        expect(result.missing).toEqual([]);
        expect(result.invalid).toEqual([key]);
        expect(mailIdentityDiagnosticCodes(result)).toEqual([`INVALID_${key}`]);
        expect(JSON.stringify(result)).not.toContain(value);
      });
    }
  }

  it("ignores legacy-only variables instead of treating them as fallback identity", () => {
    const resolved = resolveMailIdentity({
      MAIL_FROM: "hello@yulalab.com",
      LEADS_INTERNAL_ADDRESS: "yula@yulalab.com",
    });

    expect(resolved.transport.ready).toBe(false);
    expect(resolved.transport.missing).toEqual([
      MAIL_IDENTITY_ENV.fromEmail,
      MAIL_IDENTITY_ENV.fromName,
      MAIL_IDENTITY_ENV.replyToEmail,
    ]);
    expect(resolved.internalRoute.ready).toBe(false);
    expect(resolved.internalRoute.missing).toEqual([MAIL_IDENTITY_ENV.internalAddress]);
  });

  it("keeps the base transport ready when only the internal address is invalid", () => {
    const resolved = resolveMailIdentity(
      withValue(MAIL_IDENTITY_ENV.internalAddress, "other@yulalab.com"),
    );

    expect(resolved.transport.ready).toBe(true);
    expect(resolved.internalRoute.ready).toBe(false);
    expect(mailIdentityDiagnosticCodes(resolved.internalRoute)).toEqual([
      `INVALID_${MAIL_IDENTITY_ENV.internalAddress}`,
    ]);
  });
});
