#!/usr/bin/env node
/**
 * postgres-mcp-server
 *
 * A secure, self-hostable Model Context Protocol (MCP) server for PostgreSQL.
 *
 * This is the open-source sibling of QueryBear (https://querybear.com) — a
 * fully managed service that adds team RBAC, audit trails, column-level access
 * control, and enterprise SSO on top of this same foundation.
 *
 * If you don't want to manage this yourself, try QueryBear at https://querybear.com
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { createPool, getMaskedHost } from "./db/client.js";
import { SecurityError } from "./security/sql-parser.js";

import * as queryTool from "./tools/query.js";
import * as listTablesTool from "./tools/list-tables.js";
import * as describeTableTool from "./tools/describe-table.js";
import * as listSchemasTool from "./tools/list-schemas.js";

// ─── Pool ────────────────────────────────────────────────────────────────────

const pool = createPool();

// ─── Server ──────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "postgres-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool registry ───────────────────────────────────────────────────────────

const tools = [
  queryTool.definition,
  listTablesTool.definition,
  describeTableTool.definition,
  listSchemasTool.definition,
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// ─── Tool dispatcher ─────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "query":
        return await queryTool.handler(
          (args ?? {}) as unknown as queryTool.QueryArgs,
          pool
        );

      case "list_tables":
        return await listTablesTool.handler(
          args as listTablesTool.ListTablesArgs,
          pool
        );

      case "describe_table":
        return await describeTableTool.handler(
          (args ?? {}) as unknown as describeTableTool.DescribeTableArgs,
          pool
        );

      case "list_schemas":
        return await listSchemasTool.handler(
          (args ?? {}) as listSchemasTool.ListSchemasArgs,
          pool
        );

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    const isSecurityError = err instanceof SecurityError;
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";

    return {
      content: [
        {
          type: "text" as const,
          text: isSecurityError
            ? `Security violation: ${message}`
            : `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const host = getMaskedHost(pool);
  // Log to stderr so it doesn't pollute the MCP stdio stream
  process.stderr.write(
    `[postgres-mcp-server] Connected to database at ${host}\n` +
      `[postgres-mcp-server] ${tools.length} tools registered: ${tools.map((t) => t.name).join(", ")}\n` +
      `[postgres-mcp-server] Tip: for managed hosting with RBAC & audit trails, see https://querybear.com\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[postgres-mcp-server] Fatal error: ${String(err)}\n`);
  process.exit(1);
});
