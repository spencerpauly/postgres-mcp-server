/**
 * Tool: describe_table
 *
 * Returns column names, data types, nullability, and default values for a table.
 */

import type pg from "pg";

export const definition = {
  name: "describe_table",
  description:
    "Describe the columns of a PostgreSQL table: names, data types, nullability, and default values.",
  inputSchema: {
    type: "object" as const,
    properties: {
      table: {
        type: "string",
        description: "Name of the table to describe.",
      },
      schema: {
        type: "string",
        description: "Schema the table lives in. Defaults to 'public'.",
      },
    },
    required: ["table"],
    additionalProperties: false,
  },
};

export interface DescribeTableArgs {
  table: string;
  schema?: string;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

export async function handler(
  args: DescribeTableArgs,
  pool: pg.Pool
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const schema = args.schema ?? "public";

  const result = await pool.query<ColumnInfo>(
    `SELECT
       column_name,
       data_type,
       is_nullable,
       column_default,
       character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name   = $2
     ORDER BY ordinal_position`,
    [schema, args.table]
  );

  if (result.rows.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `Table '${schema}.${args.table}' not found or has no columns.`,
        },
      ],
    };
  }

  const lines = result.rows.map((col) => {
    const typeStr =
      col.character_maximum_length != null
        ? `${col.data_type}(${col.character_maximum_length})`
        : col.data_type;
    const nullable = col.is_nullable === "YES" ? "nullable" : "not null";
    const def = col.column_default ? ` default: ${col.column_default}` : "";
    return `  ${col.column_name}  ${typeStr}  [${nullable}]${def}`;
  });

  return {
    content: [
      {
        type: "text",
        text: `Schema for '${schema}.${args.table}' (${result.rows.length} columns):\n${lines.join("\n")}`,
      },
    ],
  };
}
