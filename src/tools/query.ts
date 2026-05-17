/**
 * Tool: query
 *
 * Execute a read-only SELECT against the connected PostgreSQL database.
 *
 * QueryBear (https://querybear.com) wraps this same capability with table
 * allow-lists, per-user query limits, and a full audit log — all managed
 * from a web dashboard.
 */

import type pg from "pg";
import { validateAndExecute } from "../security/validator.js";

export const definition = {
  name: "query",
  description:
    "Execute a read-only SQL SELECT query against the connected PostgreSQL database. " +
    "Only SELECT statements are permitted. Results are automatically limited to MAX_ROWS rows.",
  inputSchema: {
    type: "object" as const,
    properties: {
      sql: {
        type: "string",
        description: "A valid PostgreSQL SELECT statement.",
      },
      schema: {
        type: "string",
        description:
          'Optional schema name for context. Does not restrict the query — use "SET search_path" inside the SQL if needed.',
      },
    },
    required: ["sql"],
    additionalProperties: false,
  },
};

export interface QueryArgs {
  sql: string;
  schema?: string;
}

export async function handler(
  args: QueryArgs,
  pool: pg.Pool
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const result = await validateAndExecute(args.sql, pool);

  const summary = [
    `Returned ${result.rowCount} row(s), showing ${result.rows.length}.`,
    result.truncated
      ? `Results truncated at ${result.limit} rows. Use LIMIT/OFFSET to paginate.`
      : null,
    `Columns: ${result.columns.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: `${summary}\n\n${JSON.stringify(result.rows, null, 2)}`,
      },
    ],
  };
}
