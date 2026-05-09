# AGENTS.md — AI Agent Guidelines

## Project Summary

This is a **Telegram Activity Tracker** — a Cloudflare Workers application that ingests Telegram messages via webhook, stores per-user daily message counts in a D1 database, and serves an admin dashboard for monitoring group member inactivity over the past 7 days.

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Framework:** [Hono](https://hono.dev) (v4.x) — lightweight web framework for edge runtimes
- **Database:** Cloudflare D1 (SQLite-compatible)
- **Language:** TypeScript (strict mode, ES2021 target)
- **Auth:** HTTP Basic Auth via `hono/basic-auth` middleware
- **Build/Deploy:** Wrangler CLI (`wrangler dev` / `wrangler deploy`)

## Project Structure

```
tg-activity-tracker/
├── src/
│   ├── index.ts        # Main app: routes, middleware, webhook handler
│   └── frontend.ts     # Admin dashboard HTML (exported as a template string)
├── schema.sql          # D1 database DDL (chats, users, daily_activity tables)
├── wrangler.toml       # Cloudflare Workers config + D1 binding
├── tsconfig.json       # TypeScript config
├── package.json        # Dependencies and scripts
└── .gitignore
```

## Key Architecture Decisions

1. **Single-worker monolith.** The entire app (webhook ingestion, API, and frontend) lives in one Cloudflare Worker. There is no separate frontend build step — the dashboard HTML is an inline template string exported from `src/frontend.ts`.

2. **Private chats are consolidated.** The `/api/chats` endpoint merges all private (DM) chats into a single "All Private Chats" entry using a SQL `UNION ALL` to prevent individual DMs from cluttering the admin chat selector. When `chat_id=private` is passed to `/api/report`, the query filters across all chats with `type = 'private'`.

3. **Upsert-everywhere pattern.** The webhook handler uses `INSERT ... ON CONFLICT ... DO UPDATE` for all three tables so that chat metadata, user metadata, and activity counts stay current without separate "create" vs "update" logic.

4. **7-day rolling window.** The report query uses a recursive CTE to generate the last 7 days, then LEFT JOINs activity data. This means users with zero messages in the window still appear if they have *any* historical activity in that chat.

## Database Schema

Three tables — see `schema.sql` for full DDL:

- **`chats`** (`id INTEGER PK`, `title TEXT`, `type TEXT`, `first_seen_at DATETIME`)
- **`users`** (`id INTEGER PK`, `username TEXT`, `first_name TEXT`, `last_name TEXT`, `joined_at DATETIME`)
- **`daily_activity`** (`chat_id INTEGER`, `user_id INTEGER`, `date TEXT`, `message_count INTEGER`, composite PK on all three, FKs to chats/users)

### Important: D1 is SQLite

- Use SQLite-compatible SQL syntax (e.g., `date()`, `IFNULL()`, no `ILIKE`).
- D1 does not support migrations — schema changes require `wrangler d1 execute` with raw SQL.

## Route Map

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/webhook` | None | Telegram webhook — ingests messages |
| `GET` | `/admin` | Basic Auth | Serves dashboard HTML |
| `GET` | `/api/chats` | Basic Auth | Lists tracked chats |
| `GET` | `/api/report?chat_id=<id>` | Basic Auth | 7-day activity report |

## Coding Conventions

- **No external frontend tooling.** The dashboard is pure HTML/CSS/JS inside a TypeScript template string (`src/frontend.ts`). Keep it that way unless migrating to a proper frontend framework.
- **Keep it single-file friendly.** The app is intentionally minimal. Avoid over-abstracting into many files unless complexity genuinely warrants it.
- **Use Hono idioms.** Context via `c.env.*` for bindings, `c.req.query()` for query params, `c.json()` / `c.html()` / `c.text()` for responses.
- **Type the `Bindings`.** The Hono app is typed with `Hono<{ Bindings: Bindings }>`. Any new env vars or D1 bindings must be added to the `Bindings` type in `src/index.ts`.
- **SQL in-line.** Queries are written inline using template literals. Use parameterized `.bind()` to prevent injection — never interpolate user input directly into SQL.

## Environment & Secrets

| Variable | Where Set | Default |
|---|---|---|
| `TG_BOT_TOKEN` | `wrangler secret` | — (required) |
| `ADMIN_USERNAME` | `wrangler secret` or `wrangler.toml` `[vars]` | `admin` |
| `ADMIN_PASSWORD` | `wrangler secret` or `wrangler.toml` `[vars]` | `admin` |

The D1 database is bound as `DB` in `wrangler.toml`.

## Common Tasks

### Adding a new API route

1. Add the route in `src/index.ts` using `app.get()` / `app.post()` etc.
2. If it needs auth, place it under the `/api/*` prefix (already covered by the auth middleware).
3. Access D1 via `c.env.DB.prepare(sql).bind(...).all()` or `.run()`.

### Modifying the dashboard

1. Edit the HTML template string in `src/frontend.ts`.
2. All CSS is inline in a `<style>` block; all JS is inline in a `<script>` block.
3. The frontend fetches data from `/api/chats` and `/api/report` using the browser's `fetch()`.

### Changing the database schema

1. Update `schema.sql`.
2. Run against the remote D1: `wrangler d1 execute tg-activity-tracker-db --file=schema.sql`
3. **Warning:** The current `schema.sql` includes `DROP TABLE IF EXISTS` — running it will wipe existing data. For production changes, write incremental `ALTER TABLE` statements instead.

### Deploying

```bash
npm run deploy    # runs `wrangler deploy`
```

### Local dev

```bash
npm run dev       # runs `wrangler dev`
```

## Testing Notes

- There are no automated tests currently. Testing is done manually by sending messages to the bot and checking the admin dashboard.
- For local testing, use `wrangler dev` and tunnel with ngrok, then register the tunnel URL as the Telegram webhook.
