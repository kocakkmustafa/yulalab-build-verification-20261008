import { Pool } from "pg";

/**
 * Attribution/lead database access.
 *
 * This is NOT a product database. It holds pseudonymous funnel rows and
 * (from Y-P1-002) leads and consents; it is never joined against LifeOS,
 * Burun Farkı or Braavolabs data.
 *
 * Serverless note: `max: 1`. Each Vercel lambda instance keeps at most one
 * connection, because dozens of warm instances each holding a 10-connection
 * pool is how a small Postgres runs out of connections under mild traffic.
 * Throughput comes from instance count, not from per-instance pool size.
 */
/**
 * Pools keyed by connection string, not one bare singleton.
 *
 * A single cached pool served whichever DATABASE_URL happened to be set when
 * it was first created, so two test files driving routes against different
 * schemas raced: 2, 4, 7 and 9 failures across four consecutive full runs
 * while each file passed alone. Serialising the files would have hidden that
 * rather than removed it — the same call the schema isolation faced earlier.
 *
 * It is also more correct in production: a configuration change should never
 * be served by a pool built for the previous one. In practice exactly one
 * entry exists, because the URL never changes there.
 */
export type DatabaseRole = "intake" | "mail" | "purge";

const ROLE_ENV: Record<DatabaseRole, string> = {
  intake: "YULA_INTAKE_DATABASE_URL",
  mail: "YULA_MAIL_DATABASE_URL",
  purge: "YULA_PURGE_DATABASE_URL",
};
const DATABASE_ROLES = Object.keys(ROLE_ENV) as DatabaseRole[];
const pools = new Map<string, Pool>();

function isLocalHost(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    // URL.hostname returns an IPv6 literal WITH its brackets, so a bare
    // "::1" comparison never matched and that branch was dead.
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  } catch {
    // Unparseable connection string: assume remote and keep TLS on. Failing
    // towards encryption is the safe direction.
    return false;
  }
}

export function databaseUrl(role: DatabaseRole): string | undefined {
  return process.env[ROLE_ENV[role]] || undefined;
}

type DatabaseRoleConfiguration =
  | { ready: true }
  | {
      ready: false;
      reason:
        | "missing_role_database_url"
        | "invalid_role_database_url"
        | "shared_role_database_identity"
        | "missing_database_schema"
        | "unsafe_database_schema"
        | "connection_schema_override";
    };

function credentialIdentity(connectionString: string): string | undefined {
  try {
    const url = new URL(connectionString);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return undefined;
    if (!url.username || !url.hostname || !url.pathname || url.pathname === "/") return undefined;
    return decodeURIComponent(url.username).toLowerCase();
  } catch {
    return undefined;
  }
}

export function validateDatabaseRoleConfiguration(): DatabaseRoleConfiguration {
  const schema = process.env.YULA_DATABASE_SCHEMA;
  if (!schema) return { ready: false, reason: "missing_database_schema" };
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema) || ["public", "pg_catalog", "information_schema"].includes(schema)) {
    return { ready: false, reason: "unsafe_database_schema" };
  }
  const urls = DATABASE_ROLES.map((role) => databaseUrl(role));
  if (urls.some((url) => !url)) return { ready: false, reason: "missing_role_database_url" };
  const identities = urls.map((url) => credentialIdentity(url as string));
  if (identities.some((identity) => !identity)) {
    return { ready: false, reason: "invalid_role_database_url" };
  }
  if (new Set(identities).size !== DATABASE_ROLES.length) {
    return { ready: false, reason: "shared_role_database_identity" };
  }
  for (const connectionString of urls as string[]) {
    const url = new URL(connectionString);
    if (url.searchParams.has("search_path")) {
      return { ready: false, reason: "connection_schema_override" };
    }
    const options = url.searchParams.get("options");
    if (options !== null && options.trim() !== `-c search_path=${schema}`) {
      return { ready: false, reason: "connection_schema_override" };
    }
  }
  return { ready: true };
}

export function isDatabaseConfigured(role: DatabaseRole): boolean {
  return Boolean(databaseUrl(role)) && validateDatabaseRoleConfiguration().ready;
}

export function getPool(role: DatabaseRole): Pool {
  const configuration = validateDatabaseRoleConfiguration();
  const url = databaseUrl(role);
  if (!configuration.ready || !url) {
    throw new Error("database role configuration is unavailable");
  }
  const schema = process.env.YULA_DATABASE_SCHEMA as string;
  const cacheKey = `${role}\u0000${schema}\u0000${url}`;
  const existing = pools.get(cacheKey);
  if (existing) return existing;

  {
    const pool = new Pool({
      connectionString: url,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      // Managed Postgres (Neon/Supabase/RDS) terminates plaintext; local
      // development does not speak TLS at all. Decided by the URL rather
      // than by NODE_ENV so a production-pointing local run still uses TLS.
      //
      // Matched against the parsed HOSTNAME, not the whole string: testing
      // the connection string meant a production URL whose password or
      // database name happened to contain "localhost" silently dropped TLS
      // and sent those very credentials in the clear.
      ssl: isLocalHost(url) ? undefined : { rejectUnauthorized: true },
      options: `-c search_path=${schema}`,
    });
    pools.set(cacheKey, pool);
    return pool;
  }
}

/** Test-only: drop the cached pool so a suite can point at another database. */
/**
 * Test-only: drop the cached pool for the CURRENT DATABASE_URL so a suite
 * can point at another database.
 *
 * Scoped to one URL on purpose. Closing every pool would tear down a pool
 * another test file is mid-query on — the cross-file destruction this map
 * was introduced to prevent, reintroduced by the cleanup.
 */
export async function resetPool(role: DatabaseRole): Promise<void> {
  const url = databaseUrl(role);
  if (!url) return;
  const schema = process.env.YULA_DATABASE_SCHEMA;
  if (!schema) return;
  const cacheKey = `${role}\u0000${schema}\u0000${url}`;
  const pool = pools.get(cacheKey);
  if (!pool) return;
  pools.delete(cacheKey);
  await pool.end();
}

/** Test-only export of the TLS host decision. */
export const isLocalHostForTest = isLocalHost;
