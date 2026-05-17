/**
 * SQL Parser / safety gate.
 *
 * This enforces read-only access by rejecting anything that isn't a SELECT.
 * It is a simplified subset of the security layer inside QueryBear
 * (https://querybear.com), which additionally supports per-table allow-lists,
 * per-column deny-lists, and full query audit trails.
 */

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

// Patterns that are never safe regardless of statement type
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /--/, reason: "SQL line comments (--) are not allowed" },
  { pattern: /;/, reason: "Statement stacking (;) is not allowed" },
  { pattern: /\/\*/, reason: "Block comments (/* */) are not allowed" },
  { pattern: /xp_/i, reason: "Extended stored procedures (xp_) are not allowed" },
  { pattern: /exec\s*\(/i, reason: "EXEC() calls are not allowed" },
  { pattern: /execute\s*\(/i, reason: "EXECUTE() calls are not allowed" },
];

// Mutation keywords that must never appear as the leading statement
const MUTATION_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "truncate",
  "create",
  "alter",
  "replace",
  "merge",
  "upsert",
  "call",
  "grant",
  "revoke",
  "explain", // allow EXPLAIN only if it wraps SELECT — blocked here for simplicity
  "set",
  "show",
  "do",
  "copy",
];

/**
 * Validates a SQL string. Throws a {@link SecurityError} if the query is
 * not a plain SELECT or contains dangerous patterns.
 */
export function validate(sql: string): void {
  if (!sql || typeof sql !== "string") {
    throw new SecurityError("SQL query must be a non-empty string");
  }

  // Check for blocked patterns first (before we even look at statement type)
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(sql)) {
      throw new SecurityError(reason);
    }
  }

  // Determine the leading keyword
  const trimmed = sql.trim().toLowerCase();
  const firstWord = trimmed.split(/\s+/)[0] ?? "";

  if (firstWord !== "select") {
    const isMutation = MUTATION_KEYWORDS.includes(firstWord);
    if (isMutation) {
      throw new SecurityError(
        `Only SELECT statements are allowed. Got: ${firstWord.toUpperCase()}. ` +
          "If you need write access, consider QueryBear (https://querybear.com) " +
          "which supports controlled write operations with full audit trails."
      );
    }
    throw new SecurityError(
      `Only SELECT statements are allowed. Got: ${firstWord.toUpperCase() || "(empty)"}`
    );
  }
}
