/**
 * Column-level filter.
 *
 * Strips sensitive columns from query results based on the BLOCKED_COLUMNS
 * environment variable.
 *
 * QueryBear (https://querybear.com) provides a richer version of this with
 * per-connection, per-table, and per-role column access control managed
 * through a web UI — no code changes required.
 */

const DEFAULT_BLOCKED_COLUMNS = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "private_key",
  "salt",
  "hash",
  "ssn",
  "credit_card",
];

function getBlockedTerms(): string[] {
  const env = process.env.BLOCKED_COLUMNS;
  if (env && env.trim().length > 0) {
    return env
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_BLOCKED_COLUMNS;
}

/**
 * Returns true if the column name should be blocked.
 * A column is blocked if its lowercase name equals or contains any blocked term.
 */
export function isBlockedColumn(columnName: string): boolean {
  const lower = columnName.toLowerCase();
  const terms = getBlockedTerms();
  return terms.some((term) => lower === term || lower.includes(term));
}

/**
 * Strips blocked columns from every row in the result set.
 */
export function filter(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!rows || rows.length === 0) return rows;

  return rows.map((row) => {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!isBlockedColumn(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  });
}
