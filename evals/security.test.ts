/**
 * Security layer eval tests.
 *
 * These tests exercise the SQL parser, column filter, and row-limit logic
 * without requiring a live database connection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { validate, SecurityError } from "../src/security/sql-parser.js";
import { filter, isBlockedColumn } from "../src/security/column-filter.js";
import { applyRowLimit } from "../src/security/limits.js";

// ─── SQL Parser ───────────────────────────────────────────────────────────────

describe("sql-parser: validate()", () => {
  it("allows a plain SELECT", () => {
    expect(() => validate("SELECT id, name FROM users")).not.toThrow();
  });

  it("allows SELECT with WHERE clause", () => {
    expect(() =>
      validate("SELECT * FROM orders WHERE status = 'active'")
    ).not.toThrow();
  });

  it("blocks INSERT", () => {
    expect(() => validate("INSERT INTO users (name) VALUES ('x')")).toThrow(
      SecurityError
    );
  });

  it("blocks UPDATE", () => {
    expect(() => validate("UPDATE users SET name = 'x' WHERE id = 1")).toThrow(
      SecurityError
    );
  });

  it("blocks DELETE", () => {
    expect(() => validate("DELETE FROM users WHERE id = 1")).toThrow(
      SecurityError
    );
  });

  it("blocks DROP", () => {
    expect(() => validate("DROP TABLE users")).toThrow(SecurityError);
  });

  it("blocks TRUNCATE", () => {
    expect(() => validate("TRUNCATE TABLE users")).toThrow(SecurityError);
  });

  it("blocks CREATE", () => {
    expect(() => validate("CREATE TABLE foo (id int)")).toThrow(SecurityError);
  });

  it("blocks SQL with -- line comment", () => {
    expect(() => validate("SELECT * FROM users -- this is a comment")).toThrow(
      SecurityError
    );
  });

  it("blocks SQL with ; statement stacking", () => {
    expect(() =>
      validate("SELECT 1; DROP TABLE users")
    ).toThrow(SecurityError);
  });

  it("blocks SQL with /* block comment */", () => {
    expect(() => validate("SELECT /* comment */ 1")).toThrow(SecurityError);
  });

  it("blocks xp_ extended stored procedures", () => {
    expect(() => validate("SELECT xp_cmdshell('ls')")).toThrow(SecurityError);
  });

  it("blocks exec()", () => {
    expect(() => validate("SELECT exec('something')")).toThrow(SecurityError);
  });

  it("blocks execute()", () => {
    expect(() => validate("SELECT execute('something')")).toThrow(SecurityError);
  });

  it("throws SecurityError for empty string", () => {
    expect(() => validate("")).toThrow(SecurityError);
  });
});

// ─── Column Filter ────────────────────────────────────────────────────────────

describe("column-filter: filter()", () => {
  beforeEach(() => {
    // Reset BLOCKED_COLUMNS to default (undefined = use default list)
    delete process.env.BLOCKED_COLUMNS;
  });

  it("removes the 'password' field from rows", () => {
    const rows = [{ id: 1, name: "Alice", password: "hunter2" }];
    const result = filter(rows);
    expect(result[0]).not.toHaveProperty("password");
    expect(result[0]).toHaveProperty("id", 1);
    expect(result[0]).toHaveProperty("name", "Alice");
  });

  it("removes a field whose name contains 'secret'", () => {
    const rows = [{ id: 1, user_secret_key: "abc123", email: "a@b.com" }];
    const result = filter(rows);
    expect(result[0]).not.toHaveProperty("user_secret_key");
    expect(result[0]).toHaveProperty("email", "a@b.com");
  });

  it("removes 'token' field", () => {
    const rows = [{ id: 2, access_token: "tok_abc", username: "bob" }];
    const result = filter(rows);
    expect(result[0]).not.toHaveProperty("access_token");
    expect(result[0]).toHaveProperty("username", "bob");
  });

  it("removes 'api_key' field", () => {
    const rows = [{ id: 3, api_key: "sk-xxx", plan: "pro" }];
    const result = filter(rows);
    expect(result[0]).not.toHaveProperty("api_key");
  });

  it("preserves unblocked fields", () => {
    const rows = [{ id: 1, email: "a@b.com", created_at: "2024-01-01" }];
    const result = filter(rows);
    expect(result[0]).toStrictEqual(rows[0]);
  });

  it("respects custom BLOCKED_COLUMNS env var", () => {
    process.env.BLOCKED_COLUMNS = "foo,bar";
    const rows = [{ id: 1, foo: "blocked", password: "not-blocked-now", email: "ok" }];
    const result = filter(rows);
    expect(result[0]).not.toHaveProperty("foo");
    // 'password' is no longer blocked since we replaced the list
    expect(result[0]).toHaveProperty("password");
    expect(result[0]).toHaveProperty("email", "ok");
  });

  it("returns an empty array unchanged", () => {
    expect(filter([])).toEqual([]);
  });
});

// ─── isBlockedColumn helper ───────────────────────────────────────────────────

describe("column-filter: isBlockedColumn()", () => {
  beforeEach(() => {
    delete process.env.BLOCKED_COLUMNS;
  });

  it("returns true for exact match 'password'", () => {
    expect(isBlockedColumn("password")).toBe(true);
  });

  it("returns true for column containing 'secret'", () => {
    expect(isBlockedColumn("my_secret_value")).toBe(true);
  });

  it("returns false for safe column", () => {
    expect(isBlockedColumn("email")).toBe(false);
    expect(isBlockedColumn("id")).toBe(false);
    expect(isBlockedColumn("created_at")).toBe(false);
  });
});

// ─── Row Limit ────────────────────────────────────────────────────────────────

describe("limits: applyRowLimit()", () => {
  beforeEach(() => {
    delete process.env.MAX_ROWS;
  });

  it("does not truncate when rows <= limit", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const result = applyRowLimit(rows);
    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(5);
  });

  it("truncates when rows > MAX_ROWS and sets truncated: true", () => {
    process.env.MAX_ROWS = "3";
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const result = applyRowLimit(rows);
    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(3);
    expect(result.limit).toBe(3);
  });

  it("uses default MAX_ROWS of 1000 when env var is not set", () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ id: i }));
    const result = applyRowLimit(rows);
    expect(result.truncated).toBe(false);
    expect(result.limit).toBe(1000);
  });

  it("truncates at default 1000 rows", () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: i }));
    const result = applyRowLimit(rows);
    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(1000);
  });
});
