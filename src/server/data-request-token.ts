import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV = "DATA_REQUEST_TOKEN_CURRENT_KEY_ID";
export const DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV = "DATA_REQUEST_TOKEN_CURRENT_SECRET";
export const DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV = "DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID";
export const DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV = "DATA_REQUEST_TOKEN_PREVIOUS_SECRET";
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MIN_SECRET_BYTES = 32;

export type DataRequestTokenKey = Readonly<{ id: string; secret: string }>;
export type DataRequestTokenKeyring = Readonly<{
  current: DataRequestTokenKey;
  previous?: DataRequestTokenKey;
  byId: ReadonlyMap<string, DataRequestTokenKey>;
}>;

export class DataRequestTokenConfigurationError extends Error {
  constructor() {
    super("data-request token keyring is not configured safely");
    this.name = "DataRequestTokenConfigurationError";
  }
}

function readKey(
  idName: string,
  secretName: string,
  env: NodeJS.ProcessEnv = process.env,
): DataRequestTokenKey | undefined {
  const id = env[idName]?.trim();
  const secret = env[secretName]?.trim();
  if (!id && !secret) return undefined;
  if (!id || !secret || !KEY_ID_PATTERN.test(id) || Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new DataRequestTokenConfigurationError();
  }
  return Object.freeze({ id, secret });
}

export function dataRequestTokenKeyringMissing(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const missing: string[] = [];
  if (!env[DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV]?.trim()) {
    missing.push(DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV);
  }
  const currentSecret = env[DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV]?.trim();
  if (!currentSecret || Buffer.byteLength(currentSecret, "utf8") < MIN_SECRET_BYTES) {
    missing.push(DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV);
  }
  const previousId = env[DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV]?.trim();
  const previousSecret = env[DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV]?.trim();
  if (previousId && !previousSecret) missing.push(DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV);
  if (previousSecret && !previousId) missing.push(DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV);
  return missing;
}

export function dataRequestTokenKeyring(
  env: NodeJS.ProcessEnv = process.env,
): DataRequestTokenKeyring {
  const current = readKey(
    DATA_REQUEST_TOKEN_CURRENT_KEY_ID_ENV,
    DATA_REQUEST_TOKEN_CURRENT_SECRET_ENV,
    env,
  );
  if (!current) throw new DataRequestTokenConfigurationError();
  const previous = readKey(
    DATA_REQUEST_TOKEN_PREVIOUS_KEY_ID_ENV,
    DATA_REQUEST_TOKEN_PREVIOUS_SECRET_ENV,
    env,
  );
  if (previous?.id === current.id) throw new DataRequestTokenConfigurationError();
  const byId = new Map<string, DataRequestTokenKey>([[current.id, current]]);
  if (previous) byId.set(previous.id, previous);
  return Object.freeze({ current, previous, byId });
}

export function dataRequestTokenKeyForId(
  keyId: string,
  env: NodeJS.ProcessEnv = process.env,
): DataRequestTokenKey | undefined {
  try {
    return dataRequestTokenKeyring(env).byId.get(keyId);
  } catch {
    return undefined;
  }
}

export function deriveDataRequestToken(requestId: string, secret: string): string {
  if (!UUID_PATTERN.test(requestId)) throw new TypeError("invalid data-request id");
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new DataRequestTokenConfigurationError();
  }
  return createHmac("sha256", secret)
    .update(`yulalab:data-request-verification:v1:${requestId}`)
    .digest("hex");
}

export function hashDataRequestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isDataRequestToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function tokenHashMatches(token: string, expectedHash: unknown): boolean {
  if (!isDataRequestToken(token) || typeof expectedHash !== "string" || !TOKEN_PATTERN.test(expectedHash)) {
    return false;
  }
  const actual = Buffer.from(hashDataRequestToken(token), "ascii");
  const expected = Buffer.from(expectedHash, "ascii");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function dataRequestVerificationUrl(token: string, locale: "tr" | "en"): string {
  if (!isDataRequestToken(token)) throw new TypeError("invalid data-request token");
  const prefix = locale === "en" ? "/en" : "";
  return `https://yulalab.com${prefix}/data-request/verify#token=${encodeURIComponent(token)}`;
}
