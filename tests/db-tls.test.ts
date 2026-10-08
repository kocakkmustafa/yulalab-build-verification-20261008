import { afterEach, describe, expect, it } from "vitest";
import {
  databaseUrl,
  isDatabaseConfigured,
  isLocalHostForTest,
  validateDatabaseRoleConfiguration,
} from "@/server/db";

const ROLE_ENV = [
  "YULA_INTAKE_DATABASE_URL",
  "YULA_MAIL_DATABASE_URL",
  "YULA_PURGE_DATABASE_URL",
  "YULA_DATABASE_SCHEMA",
  "DATABASE_URL",
] as const;

afterEach(() => {
  for (const name of ROLE_ENV) delete process.env[name];
});

/**
 * TLS on/off was decided by running a regex over the whole connection
 * string. A production URL whose password or database name contained the
 * substring "localhost" therefore disabled TLS and sent that password in
 * plaintext — the worst possible case for the check to get wrong.
 */
describe("TLS decision", () => {
  it("treats a real local database as local", () => {
    expect(isLocalHostForTest("postgres://localhost:5432/db")).toBe(true);
    expect(isLocalHostForTest("postgres://127.0.0.1:5432/db")).toBe(true);
  });

  it("does not disable TLS because a password or db name contains 'localhost'", () => {
    expect(isLocalHostForTest("postgres://user:localhost@db.neon.tech:5432/prod")).toBe(false);
    expect(isLocalHostForTest("postgres://user:pw@db.neon.tech:5432/localhost")).toBe(false);
    expect(isLocalHostForTest("postgres://user:pw@evil-localhost.example:5432/db")).toBe(false);
  });

  it("keeps TLS on for an unparseable string", () => {
    expect(isLocalHostForTest("not a url at all")).toBe(false);
  });
});

describe("least-privilege database role routing", () => {
  it("never falls back to the legacy shared DATABASE_URL", () => {
    process.env.DATABASE_URL = "postgres://shared:secret@db.example/yula";
    expect(databaseUrl("intake")).toBeUndefined();
    expect(databaseUrl("mail")).toBeUndefined();
    expect(databaseUrl("purge")).toBeUndefined();
    expect(isDatabaseConfigured("intake")).toBe(false);
  });

  it("maps each runtime role to its dedicated server-only credential", () => {
    process.env.YULA_DATABASE_SCHEMA = "yulalab_private";
    process.env.YULA_INTAKE_DATABASE_URL = "postgres://intake:one@db.example/yula";
    process.env.YULA_MAIL_DATABASE_URL = "postgres://mail:two@db.example/yula";
    process.env.YULA_PURGE_DATABASE_URL = "postgres://purge:three@db.example/yula";

    expect(databaseUrl("intake")).toContain("intake:one");
    expect(databaseUrl("mail")).toContain("mail:two");
    expect(databaseUrl("purge")).toContain("purge:three");
    expect(validateDatabaseRoleConfiguration()).toEqual({ ready: true });
  });

  it("rejects a missing role and shared credential identity without exposing the URL", () => {
    process.env.YULA_DATABASE_SCHEMA = "yulalab_private";
    process.env.YULA_INTAKE_DATABASE_URL = "postgres://shared:secret@db.example/yula?application_name=intake";
    process.env.YULA_MAIL_DATABASE_URL = "postgres://shared:secret@db.example/yula?application_name=mail";

    expect(validateDatabaseRoleConfiguration()).toEqual({
      ready: false,
      reason: "missing_role_database_url",
    });

    process.env.YULA_PURGE_DATABASE_URL = "postgres://purge:three@db.example/yula";
    expect(validateDatabaseRoleConfiguration()).toEqual({
      ready: false,
      reason: "shared_role_database_identity",
    });
  });

  it("requires three explicit distinct PostgreSQL usernames, regardless of host/db/query/password", () => {
    process.env.YULA_DATABASE_SCHEMA = "yulalab_private";
    process.env.YULA_INTAKE_DATABASE_URL = "postgres://shared:one@db-a.example/one";
    process.env.YULA_MAIL_DATABASE_URL = "postgres://shared:two@db-b.example/two?application_name=mail";
    process.env.YULA_PURGE_DATABASE_URL = "postgres://shared:three@db-c.example/three";
    expect(validateDatabaseRoleConfiguration()).toEqual({
      ready: false,
      reason: "shared_role_database_identity",
    });

    process.env.YULA_INTAKE_DATABASE_URL = "postgres://db-a.example/one";
    expect(validateDatabaseRoleConfiguration()).toEqual({
      ready: false,
      reason: "invalid_role_database_url",
    });
  });

  it("requires one explicit non-public schema and rejects URL-level search_path overrides", () => {
    process.env.YULA_INTAKE_DATABASE_URL = "postgres://intake:one@db.example/yula";
    process.env.YULA_MAIL_DATABASE_URL = "postgres://mail:two@db.example/yula";
    process.env.YULA_PURGE_DATABASE_URL = "postgres://purge:three@db.example/yula";
    expect(validateDatabaseRoleConfiguration()).toEqual({ ready: false, reason: "missing_database_schema" });
    process.env.YULA_DATABASE_SCHEMA = "public";
    expect(validateDatabaseRoleConfiguration()).toEqual({ ready: false, reason: "unsafe_database_schema" });
    process.env.YULA_DATABASE_SCHEMA = "yulalab_private";
    process.env.YULA_MAIL_DATABASE_URL = "postgres://mail:two@db.example/yula?options=-c%20search_path%3Dother";
    expect(validateDatabaseRoleConfiguration()).toEqual({ ready: false, reason: "connection_schema_override" });
  });
});
