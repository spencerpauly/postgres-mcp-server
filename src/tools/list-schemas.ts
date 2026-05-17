/**
 * Tool: list_schemas
 *
 * Lists all user-created schemas in the database (excludes pg_catalog and
 * information_schema).
 */

import type pg from "pg";

export const definition = {
  name: "list_schemas",
  description:
    "List all non-system schemas in the connected PostgreSQL database.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

export type ListSchemasArgs = Record<string, never>;

export async function handler(
  _args: ListSchemasArgs,
  pool: pg.Pool
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const result = await pool.query<{ schema_name: string }>(
    `SELECT schema_name
     FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
       AND schema_name NOT LIKE 'pg_toast%'
       AND schema_name NOT LIKE 'pg_temp%'
     ORDER BY schema_name`
  );

  if (result.rows.length === 0) {
    return {
      content: [{ type: "text", text: "No user schemas found." }],
    };
  }

  const lines = result.rows.map((r) => `  - ${r.schema_name}`);

  return {
    content: [
      {
        type: "text",
        text: `Schemas (${result.rows.length}):\n${lines.join("\n")}`,
      },
    ],
  };
}
