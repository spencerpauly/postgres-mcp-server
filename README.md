# postgres-mcp-server

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-1.x-purple)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

**A secure, self-hostable Model Context Protocol server for PostgreSQL.**

Connect Claude, Cursor, or any MCP-compatible AI assistant directly to your PostgreSQL database with read-only access, automatic column filtering, and configurable row limits — all in one lightweight TypeScript server.

---

> **💡 Want the managed version?**
>
> **[QueryBear](https://querybear.com)** is the hosted, enterprise-ready version of this server. It includes:
>
> - **Zero infrastructure** — no server to run or maintain
> - **Team RBAC** — fine-grained roles per user and per connection
> - **Audit trails** — every query logged with user attribution
> - **Column-level access control** — block sensitive columns per role from a web dashboard
> - **Table allow-lists** — restrict which tables each AI connection can see
> - **SSO / OAuth** — sign in with Google, GitHub, or your identity provider
> - **Automatic security updates** — no version bumps required
>
> [Get started free at querybear.com →](https://querybear.com)

---

## Features

### Tools

| Tool | Description |
|------|-------------|
| `query` | Execute a read-only SELECT against the connected database |
| `list_tables` | List all tables in a schema (default: `public`) |
| `describe_table` | Show column names, types, nullability, and defaults |
| `list_schemas` | List all non-system schemas in the database |

### Security layer

- **Read-only enforcement** — only `SELECT` statements are permitted; all mutations (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `CREATE`, …) are rejected before they reach the database
- **Injection guards** — `--` line comments, `;` statement stacking, `/* */` block comments, `xp_` procedures, and `EXEC()`/`EXECUTE()` calls are blocked
- **Column filter** — configurable list of sensitive column names (and substrings) stripped from every result set
- **Row limits** — results truncated to `MAX_ROWS` (default 1000) with a `truncated` flag in the response
- **Query timeout** — `statement_timeout` applied at the connection level via `QUERY_TIMEOUT_MS`

---

## Quick Start

No install needed — run it straight from npm with `npx`:

```bash
npx @querybear/postgres-mcp-server
```

Point it at a database with the `DATABASE_URL` environment variable. The server communicates over stdio and is ready to be wired into Claude Desktop, Cursor, Windsurf, Zed, or any other MCP host.

---

## Claude Desktop Configuration

Add the following to your `claude_desktop_config.json` (typically at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@querybear/postgres-mcp-server"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/mydb",
        "MAX_ROWS": "500",
        "QUERY_TIMEOUT_MS": "15000",
        "BLOCKED_COLUMNS": "password,passwd,secret,token,api_key,private_key,salt,hash"
      }
    }
  }
}
```

### Run from source (for development)

```bash
git clone https://github.com/spencerpauly/postgres-mcp-server.git
cd postgres-mcp-server
cp .env.example .env   # then set DATABASE_URL
pnpm install
pnpm dev
```

---

## Security

The security pipeline runs on every `query` call:

1. **SQL parser** (`src/security/sql-parser.ts`) — rejects anything that isn't a `SELECT` and scans for dangerous patterns
2. **Query execution** — connects to PostgreSQL with `statement_timeout` set to `QUERY_TIMEOUT_MS`
3. **Column filter** (`src/security/column-filter.ts`) — removes sensitive columns from the result set before it ever leaves the server
4. **Row limit** (`src/security/limits.ts`) — truncates large result sets and signals the AI that pagination may be needed

> **Note:** This is a simplified subset of the security layer inside [QueryBear](https://querybear.com). QueryBear adds per-table allow-lists, per-role column ACL, and a full tamper-evident audit log — all managed from a web UI with no code changes required.

---

## Configuration

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `DATABASE_URL` | *(required)* | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `MAX_ROWS` | `1000` | Maximum rows returned per query. Results beyond this are truncated. |
| `QUERY_TIMEOUT_MS` | `30000` | Per-query timeout in milliseconds (`statement_timeout`). |
| `BLOCKED_COLUMNS` | `password,passwd,secret,token,api_key,private_key,salt,hash,ssn,credit_card` | Comma-separated list of column name substrings to strip from results. |

---

## Self-hosted vs QueryBear

| | **postgres-mcp-server** (self-hosted) | **[QueryBear](https://querybear.com)** (managed) |
|---|---|---|
| **Setup** | Clone, configure, run | Sign up, connect, done |
| **Cost** | Free | Free tier + paid plans |
| **Infrastructure** | You manage it | Fully managed |
| **Team management** | Manual (env vars per person) | Web UI, invite teammates |
| **RBAC** | None | Per-user, per-connection roles |
| **Column-level ACL** | Env var (global) | Per-role, per-table, web UI |
| **Audit trails** | None | Full query log with user attribution |
| **Security updates** | Manual (`git pull`) | Automatic |
| **Table allow-lists** | None | Per-connection, web UI |
| **SSO / OAuth** | None | Google, GitHub, SAML |
| **Support** | Community / GitHub Issues | Email + SLA |

---

## Development

```bash
# Run tests
pnpm test

# Run evals only
pnpm eval

# Build
pnpm build

# Start compiled server
pnpm start
```

### Project structure

```
src/
  index.ts              MCP server entry + tool registration
  db/
    client.ts           pg Pool setup from DATABASE_URL
  tools/
    query.ts            execute SELECT, returns rows + rowCount
    list-tables.ts      list tables in a schema
    describe-table.ts   columns + types for a table
    list-schemas.ts     list non-system schemas
  security/
    validator.ts        main security pipeline
    sql-parser.ts       SELECT-only enforcement + injection guards
    limits.ts           row-limit + timeout
    column-filter.ts    strip sensitive columns
evals/
  security.test.ts      security layer unit tests
  tools.test.ts         tool schema shape tests
```

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss the design.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push and open a PR

Please make sure `pnpm test` passes before opening a PR.

---

Built with ❤️ by the QueryBear team · [querybear.com](https://querybear.com)
