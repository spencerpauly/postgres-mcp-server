/**
 * Tool schema eval tests.
 *
 * Verifies that each tool exports a valid definition object with the
 * expected JSON Schema shape.
 */

import { describe, it, expect } from "vitest";
import { definition as queryDef } from "../src/tools/query.js";
import { definition as listTablesDef } from "../src/tools/list-tables.js";
import { definition as describeTableDef } from "../src/tools/describe-table.js";
import { definition as listSchemasDef } from "../src/tools/list-schemas.js";

// Helper to assert a definition is a well-formed MCP tool definition
function assertValidDefinition(def: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}) {
  expect(typeof def.name).toBe("string");
  expect(def.name.length).toBeGreaterThan(0);

  expect(typeof def.description).toBe("string");
  expect(def.description.length).toBeGreaterThan(0);

  expect(typeof def.inputSchema).toBe("object");
  expect(def.inputSchema).not.toBeNull();
  expect(def.inputSchema.type).toBe("object");
  expect(def.inputSchema).toHaveProperty("properties");
}

describe("tool definitions", () => {
  it("query tool has a valid definition", () => {
    assertValidDefinition(queryDef);
    expect(queryDef.name).toBe("query");
    expect(Array.isArray(queryDef.inputSchema.required)).toBe(true);
    expect(queryDef.inputSchema.required).toContain("sql");
  });

  it("query tool inputSchema includes 'sql' property", () => {
    const props = queryDef.inputSchema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("sql");
    expect((props.sql as Record<string, unknown>).type).toBe("string");
  });

  it("query tool inputSchema includes optional 'schema' property", () => {
    const props = queryDef.inputSchema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("schema");
  });

  it("list_tables tool has a valid definition", () => {
    assertValidDefinition(listTablesDef);
    expect(listTablesDef.name).toBe("list_tables");
  });

  it("list_tables tool inputSchema has optional 'schema' property", () => {
    const props = listTablesDef.inputSchema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("schema");
    // schema is optional — not in required
    const required = listTablesDef.inputSchema.required as string[];
    expect(required).not.toContain("schema");
  });

  it("describe_table tool has a valid definition", () => {
    assertValidDefinition(describeTableDef);
    expect(describeTableDef.name).toBe("describe_table");
  });

  it("describe_table tool requires 'table' field", () => {
    expect(Array.isArray(describeTableDef.inputSchema.required)).toBe(true);
    expect(describeTableDef.inputSchema.required).toContain("table");
  });

  it("describe_table tool inputSchema includes 'schema' property", () => {
    const props = describeTableDef.inputSchema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("schema");
    expect(props).toHaveProperty("table");
  });

  it("list_schemas tool has a valid definition", () => {
    assertValidDefinition(listSchemasDef);
    expect(listSchemasDef.name).toBe("list_schemas");
  });

  it("list_schemas tool takes no required inputs", () => {
    const required = listSchemasDef.inputSchema.required as string[];
    expect(required).toHaveLength(0);
  });

  it("all tool names are unique", () => {
    const names = [
      queryDef.name,
      listTablesDef.name,
      describeTableDef.name,
      listSchemasDef.name,
    ];
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
