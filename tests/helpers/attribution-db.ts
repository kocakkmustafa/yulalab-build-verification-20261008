import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * Per-suite database isolation.
 *
 * Both attribution suites talk to the same real PostgreSQL, and vitest runs
 * test FILES in parallel. Sharing one table meant one suite's `TRUNCATE`
 * deleted rows the other had just written — a failure that appeared only in
 * the full run and vanished when either file was run alone.
 *
 * Serialising the files would have hidden the problem rather than removed
 * it. Instead each suite gets its own schema via the connection's
 * `search_path`, so the isolation is a property of the setup rather than of
 * the execution order. Note the manual %20 encoding: URLSearchParams emits
 * `+` for a space, and pg's connection-string parser calls
 * decodeURIComponent, which leaves `+` as a literal plus and produces an
 * unparseable option.
 */
export function testDatabaseUrl(schema: string): string {
  const base =
    process.env.ATTRIBUTION_TEST_DATABASE_URL ??
    "postgres://localhost:5432/yula_attribution_test";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}options=${encodeURIComponent(`-c search_path=${schema}`)}`;
}

export function migrationSql(): string {
  return readFileSync(
    path.resolve(import.meta.dirname, "../../db/migrations/0001_attribution.sql"),
    "utf8",
  );
}

/** Fresh schema + migration. Throws if PostgreSQL is unreachable — never skips. */
export async function createIsolatedSchema(schema: string): Promise<Pool> {
  // max 6 so a test can hold connections busy — proving a transaction is
  // real under concurrency needs spare capacity, and max:2 made those tests
  // measure pool exhaustion instead.
  const pool = new Pool({ connectionString: testDatabaseUrl(schema), max: 6 });
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(migrationSql());
  return pool;
}

export async function dropSchema(pool: Pool, schema: string): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
