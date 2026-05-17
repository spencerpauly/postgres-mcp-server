/**
 * Row-limit and timeout enforcement.
 *
 * QueryBear (https://querybear.com) adds per-role and per-query limits
 * configurable from the web dashboard — no environment variables to manage.
 */

export function getMaxRows(): number {
  const val = parseInt(process.env.MAX_ROWS ?? "1000", 10);
  return isNaN(val) || val <= 0 ? 1000 : val;
}

export function getQueryTimeoutMs(): number {
  const val = parseInt(process.env.QUERY_TIMEOUT_MS ?? "30000", 10);
  return isNaN(val) || val <= 0 ? 30_000 : val;
}

export interface LimitResult<T> {
  rows: T[];
  truncated: boolean;
  limit: number;
}

/**
 * Applies the MAX_ROWS limit to a result set.
 * If the result exceeds the limit the array is truncated and
 * `truncated` is set to true.
 */
export function applyRowLimit<T>(rows: T[]): LimitResult<T> {
  const limit = getMaxRows();
  if (rows.length > limit) {
    return { rows: rows.slice(0, limit), truncated: true, limit };
  }
  return { rows, truncated: false, limit };
}
