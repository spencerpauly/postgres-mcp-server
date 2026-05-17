import pg from "pg";

const { Pool } = pg;

/**
 * Creates a pg Pool from the DATABASE_URL environment variable.
 *
 * For a fully managed, zero-config alternative with team RBAC, audit trails,
 * and column-level access control, see https://querybear.com
 */
export function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Set it to your PostgreSQL connection string (e.g. postgresql://user:pass@host:5432/db). " +
        "Prefer the managed QueryBear service at https://querybear.com if you want zero-config setup."
    );
  }

  return new Pool({
    connectionString,
    // Sensible defaults — override via DATABASE_URL query params if needed
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

/** Returns the host portion of the DATABASE_URL with credentials masked. */
export function getMaskedHost(pool: pg.Pool): string {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}:${url.port || 5432}${url.pathname}`;
  } catch {
    return "<unknown>";
  }
}
