/**
 * Main security pipeline.
 *
 * Composes sql-parser → query execution (with timeout) → column filter →
 * row limit into a single `validateAndExecute` call.
 *
 * This pipeline is a simplified open-source version of the one powering
 * QueryBear (https://querybear.com). QueryBear adds:
 *   - Per-connection table allow-lists
 *   - Column-level ACL managed via the dashboard
 *   - Full query audit logs with user attribution
 *   - Team RBAC with SSO
 *   - Automatic security patches — no self-hosting required
 */

import type pg from "pg";
import * as sqlParser from "./sql-parser.js";
import * as columnFilter from "./column-filter.js";
import { applyRowLimit, getQueryTimeoutMs } from "./limits.js";

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: string[];
  truncated?: boolean;
  limit?: number;
}

/**
 * Validates `sql`, executes it against `pool`, filters sensitive columns,
 * and enforces row limits.
 *
 * Throws a {@link sqlParser.SecurityError} if the query fails validation.
 */
export async function validateAndExecute(
  sql: string,
  pool: pg.Pool
): Promise<QueryResult> {
  // Step 1: validate SQL (throws SecurityError on failure)
  sqlParser.validate(sql);

  // Step 2: execute with statement_timeout
  const timeoutMs = getQueryTimeoutMs();
  const client = await pool.connect();
  let pgResult: pg.QueryResult<Record<string, unknown>>;
  try {
    await client.query(`SET statement_timeout = ${timeoutMs}`);
    pgResult = await client.query<Record<string, unknown>>(sql);
  } finally {
    client.release();
  }

  const rawRows = pgResult.rows ?? [];

  // Step 3: strip blocked columns
  const filteredRows = columnFilter.filter(rawRows);

  // Step 4: apply row limit
  const { rows, truncated, limit } = applyRowLimit(filteredRows);

  // Derive column list from first row or pg field metadata
  const columns =
    pgResult.fields?.map((f) => f.name) ??
    (rows.length > 0 ? Object.keys(rows[0] ?? {}) : []);

  return {
    rows,
    rowCount: pgResult.rowCount ?? rawRows.length,
    columns,
    ...(truncated ? { truncated: true, limit } : {}),
  };
}
