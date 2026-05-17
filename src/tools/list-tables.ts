/**
 * Tool: list_tables
 *
 * Lists all user tables in the specified schema.
 */

import type pg from "pg";

export const definition = {
  name: "list_tables",
  description:
    "List all tables in a PostgreSQL schema. Defaults to the 'public' schema.",
  inputSchema: {
    type: "object" as const,
    properties: {
      schema: {
        type: "string",
        description: "Schema name to list tables from. Defaults to 'public'.",
      },
    },
    required: [],
    additionalProperties: false,
  },
};

export interface ListTablesArgs {
  schema?: string;
}

export async function handler(
  args: ListTablesArgs,
  pool: pg.Pool
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const schema = args.schema ?? "public";

  const result = await pool.query<{ table_name: string; table_type: string }>(
    `SELECT table_name, table_type
     FROM information_schema.tables
     WHERE table_schema = $1
     ORDER BY table_name`,
    [schema]
  );

  if (result.rows.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No tables found in schema '${schema}'.`,
        },
      ],
    };
  }

  const lines = result.rows.map(
    (r) => `  - ${r.table_name} (${r.table_type})`
  );

  return {
    content: [
      {
        type: "text",
        text: `Tables in schema '${schema}' (${result.rows.length}):\n${lines.join("\n")}`,
      },
    ],
  };
}
