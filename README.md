# Telegram Activity Tracker

A Cloudflare Workers-based Telegram bot that tracks user messaging activity across groups and private chats, with a built-in admin dashboard for monitoring inactivity.

## Overview

This bot passively listens for messages via Telegram's webhook API and records per-user, per-chat, per-day message counts. An admin dashboard (protected by HTTP Basic Auth) lets you select any tracked group and view a 7-day activity/inactivity report for every member.

## Architecture

```
Telegram  ──webhook POST──▸  Cloudflare Worker (Hono)  ──▸  D1 Database
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                    /webhook             /admin + /api/*
                  (bot ingestion)     (dashboard & reports)
```

| Component | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | [Hono](https://hono.dev) |
| Database | Cloudflare D1 (SQLite) |
| Language | TypeScript |
| Auth | HTTP Basic Auth (via `hono/basic-auth`) |

### Source Files

| File | Purpose |
|---|---|
| `src/index.ts` | Main application — webhook handler, API routes, auth middleware |
| `src/frontend.ts` | Exported HTML string for the admin dashboard (inline CSS + JS) |
| `schema.sql` | D1 database schema (3 tables) |
| `wrangler.toml` | Cloudflare Workers configuration and D1 binding |

## Database Schema

Three tables in D1:

- **`chats`** — Stores chat metadata (id, title, type). Types: `private`, `group`, `supergroup`, `channel`.
- **`users`** — Stores user metadata (id, username, first/last name). Upserted on every message.
- **`daily_activity`** — Aggregated message counts keyed by `(chat_id, user_id, date)`. Incremented on each incoming message.

See [`schema.sql`](schema.sql) for the full DDL.

## API Routes

All `/api/*` and `/admin/*` routes require HTTP Basic Auth.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin` | Serves the admin dashboard HTML |
| `GET` | `/api/chats` | Lists all tracked chats. Private chats are consolidated into a single "All Private Chats" entry. Groups are listed individually. |
| `GET` | `/api/report?chat_id=<id>` | Returns a 7-day activity report for the given chat. Use `chat_id=private` for the consolidated private-chat view. |
| `POST` | `/webhook` | Telegram webhook endpoint (no auth). Processes incoming messages and upserts chat/user/activity data. |

### Report Response Shape

```json
[
  {
    "user_id": 123456,
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "total_messages": 42,
    "days_active": 5,
    "days_inactive": 2
  }
]
```

## Setup & Deployment

### Prerequisites

- Node.js (v18+)
- A [Cloudflare](https://cloudflare.com) account
- A Telegram bot token (from [@BotFather](https://t.me/botfather))
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)

### 1. Install dependencies

```bash
npm install
```

### 2. Create the D1 database

```bash
wrangler d1 create tg-activity-tracker-db
```

Update the `database_id` in `wrangler.toml` with the ID returned by the command above.

### 3. Apply the schema

```bash
wrangler d1 execute tg-activity-tracker-db --file=schema.sql
```

### 4. Set secrets

```bash
wrangler secret put TG_BOT_TOKEN
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD
```

### 5. Deploy

```bash
npm run deploy
```

### 6. Register the Telegram webhook

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<your-worker>.workers.dev/webhook"
```

### Local Development

```bash
npm run dev
```

This starts a local Wrangler dev server. You can use a tool like [ngrok](https://ngrok.com) to tunnel the local server and register it as the Telegram webhook for testing.

## Environment Variables / Secrets

| Variable | Required | Default | Description |
|---|---|---|---|
| `TG_BOT_TOKEN` | Yes | — | Telegram bot token |
| `ADMIN_USERNAME` | No | `admin` | Basic auth username for dashboard |
| `ADMIN_PASSWORD` | No | `admin` | Basic auth password for dashboard |

## License

ISC
