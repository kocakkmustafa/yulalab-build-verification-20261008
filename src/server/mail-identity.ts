/**
 * Canonical, server-only identity for YULALAB transactional mail.
 *
 * Runtime values are configuration so they can be read back from a deployment,
 * but V1 intentionally accepts only the founder-approved identity below. A
 * typo or a stale deployment scope therefore disables delivery rather than
 * silently sending under a different identity.
 */
if (typeof window !== "undefined") {
  throw new Error("mail-identity is server-only: mail identity is not public config");
}

export const MAIL_IDENTITY_ENV = Object.freeze({
  fromEmail: "YULA_MAIL_FROM",
  fromName: "YULA_FROM_NAME",
  replyToEmail: "YULA_REPLY_TO",
  internalAddress: "YULA_LEADS_INTERNAL_ADDRESS",
} as const);

export const APPROVED_MAIL_IDENTITY = Object.freeze({
  fromEmail: "hello@yulalab.com",
  fromName: "YULALAB",
  replyToEmail: "yula@yulalab.com",
  internalAddress: "yula@yulalab.com",
} as const);

export type MailIdentityEnvKey = (typeof MAIL_IDENTITY_ENV)[keyof typeof MAIL_IDENTITY_ENV];
export type MailIdentityEnvironment = Readonly<Record<string, string | undefined>>;

export type MailIdentity = Readonly<{
  fromEmail: typeof APPROVED_MAIL_IDENTITY.fromEmail;
  fromName: typeof APPROVED_MAIL_IDENTITY.fromName;
  replyToEmail: typeof APPROVED_MAIL_IDENTITY.replyToEmail;
}>;

export type InternalMailRoute = Readonly<{
  address: typeof APPROVED_MAIL_IDENTITY.internalAddress;
}>;

export type MailConfigurationResult<T> =
  | Readonly<{ ready: true; value: T; missing: readonly []; invalid: readonly [] }>
  | Readonly<{
      ready: false;
      missing: readonly MailIdentityEnvKey[];
      invalid: readonly MailIdentityEnvKey[];
    }>;

export type ResolvedMailIdentity = Readonly<{
  transport: MailConfigurationResult<MailIdentity>;
  internalRoute: MailConfigurationResult<InternalMailRoute>;
}>;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u;
const NO_ISSUES: readonly [] = Object.freeze([]);

type Snapshot = Readonly<Record<MailIdentityEnvKey, string | undefined>>;

function snapshotIdentityEnv(env: MailIdentityEnvironment): Snapshot {
  return Object.freeze({
    [MAIL_IDENTITY_ENV.fromEmail]: env[MAIL_IDENTITY_ENV.fromEmail],
    [MAIL_IDENTITY_ENV.fromName]: env[MAIL_IDENTITY_ENV.fromName],
    [MAIL_IDENTITY_ENV.replyToEmail]: env[MAIL_IDENTITY_ENV.replyToEmail],
    [MAIL_IDENTITY_ENV.internalAddress]: env[MAIL_IDENTITY_ENV.internalAddress],
  });
}

function isValidEmail(value: string): boolean {
  return !CONTROL_CHARACTER.test(value) && EMAIL_PATTERN.test(value);
}

function classify(
  snapshot: Snapshot,
  entries: readonly Readonly<{
    key: MailIdentityEnvKey;
    expected: string;
    kind: "email" | "name";
  }>[],
): Readonly<{
  missing: readonly MailIdentityEnvKey[];
  invalid: readonly MailIdentityEnvKey[];
}> {
  const missing: MailIdentityEnvKey[] = [];
  const invalid: MailIdentityEnvKey[] = [];

  for (const { key, expected, kind } of entries) {
    const value = snapshot[key];
    if (value === undefined || value === "") {
      missing.push(key);
      continue;
    }
    const structurallyValid = kind === "email"
      ? isValidEmail(value)
      : !CONTROL_CHARACTER.test(value);
    if (!structurallyValid || value !== expected) invalid.push(key);
  }

  return Object.freeze({ missing: Object.freeze(missing), invalid: Object.freeze(invalid) });
}

function notReady<T>(
  issues: Readonly<{
    missing: readonly MailIdentityEnvKey[];
    invalid: readonly MailIdentityEnvKey[];
  }>,
): MailConfigurationResult<T> {
  return Object.freeze({ ready: false, missing: issues.missing, invalid: issues.invalid });
}

export function resolveMailIdentity(env: MailIdentityEnvironment = process.env): ResolvedMailIdentity {
  const snapshot = snapshotIdentityEnv(env);
  const transportIssues = classify(snapshot, [
    {
      key: MAIL_IDENTITY_ENV.fromEmail,
      expected: APPROVED_MAIL_IDENTITY.fromEmail,
      kind: "email",
    },
    {
      key: MAIL_IDENTITY_ENV.fromName,
      expected: APPROVED_MAIL_IDENTITY.fromName,
      kind: "name",
    },
    {
      key: MAIL_IDENTITY_ENV.replyToEmail,
      expected: APPROVED_MAIL_IDENTITY.replyToEmail,
      kind: "email",
    },
  ]);
  const internalIssues = classify(snapshot, [
    {
      key: MAIL_IDENTITY_ENV.internalAddress,
      expected: APPROVED_MAIL_IDENTITY.internalAddress,
      kind: "email",
    },
  ]);

  const transport: MailConfigurationResult<MailIdentity> =
    transportIssues.missing.length > 0 || transportIssues.invalid.length > 0
      ? notReady(transportIssues)
      : Object.freeze({
          ready: true,
          value: Object.freeze({
            fromEmail: APPROVED_MAIL_IDENTITY.fromEmail,
            fromName: APPROVED_MAIL_IDENTITY.fromName,
            replyToEmail: APPROVED_MAIL_IDENTITY.replyToEmail,
          }),
          missing: NO_ISSUES,
          invalid: NO_ISSUES,
        });

  const internalRoute: MailConfigurationResult<InternalMailRoute> =
    internalIssues.missing.length > 0 || internalIssues.invalid.length > 0
      ? notReady(internalIssues)
      : Object.freeze({
          ready: true,
          value: Object.freeze({ address: APPROVED_MAIL_IDENTITY.internalAddress }),
          missing: NO_ISSUES,
          invalid: NO_ISSUES,
        });

  return Object.freeze({ transport, internalRoute });
}

export function mailIdentityDiagnosticCodes(
  result: Readonly<{
    ready: boolean;
    missing: readonly MailIdentityEnvKey[];
    invalid: readonly MailIdentityEnvKey[];
  }>,
): readonly string[] {
  if (result.ready) return Object.freeze([]);
  return Object.freeze([
    ...result.missing,
    ...result.invalid.map((key) => `INVALID_${key}`),
  ]);
}
