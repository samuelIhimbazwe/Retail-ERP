# RBIAP — Retail Business Intelligence & Accounting Platform

Retail OS for shops: Counter Mode (sell / stock check / receive / customer pay), inventory, purchasing, accounting, tax, BI, and alerts.

## Stack

- Next.js 16 · React 19 · TypeScript · Tailwind CSS 4
- Prisma 6 · **SQLite** (local) · **PostgreSQL** (production)
- Auth.js (NextAuth v5) · Zod · bcryptjs · html5-qrcode

## Real business setup (recommended)

```bash
npm install
cp .env.example .env
# Set AUTH_SECRET to a long random string
npm run db:wipe    # empty database (destroys all data)
npm run dev
```

Open http://localhost:3000 → **first-run setup** creates your business, main branch, chart of accounts, and owner account. Then invite staff from **User Management**.

To wipe an existing demo DB and start clean: `npm run db:wipe`, restart the app, complete `/setup`.

## Optional demo data

```bash
npm run db:seed    # loads "Kigali Fresh" sample tenant
# or
npm run db:reset   # wipe + seed
```

Demo login (seed only): `jean@kigalifresh.rw` / `demo1234`

After `db:wipe` / `db:reset`, sign out and sign in again so the session matches new DB ids.

## Optional SMTP

Add to `.env` to email invites and password resets:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=RBIAP <noreply@yourbusiness.com>
AUTH_URL=http://localhost:3000
```

Without SMTP, admins still get a copyable link / mailto draft.

## Deploy (Vercel + PostgreSQL)

SQLite is for local only. Serverless hosts cannot keep a durable SQLite file — use **PostgreSQL** (Neon, Supabase, Prisma Postgres, Railway, etc.).

### 1. Create a Postgres database

Copy the connection string (prefer the **pooled** URL if your provider offers one).

### 2. Point Prisma at Postgres

In `prisma/schema.prisma`, change the datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Commit that change before (or with) your deploy push. Keep using SQLite locally until you are ready to switch.

### 3. Set environment variables on the host

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `AUTH_URL` | Yes | Public URL, e.g. `https://your-app.vercel.app` |
| `SMTP_*` | No | Email invites / password resets |

### 4. Build & schema sync

`npm run build` already runs `prisma generate` (also via `postinstall`). On first deploy (or after schema changes), sync tables once:

```bash
# From your machine against the production DATABASE_URL, or via host CLI:
npx prisma db push
```

Or set the Vercel build command to:

```bash
prisma generate && prisma db push && next build
```

(`db push` on every build is fine for early launch; switch to `prisma migrate deploy` later if you adopt migrations.)

### 5. Push & open the app

```bash
git push
```

Connect the repo in Vercel (or your host), set the env vars, deploy. Open the production URL → complete **`/setup`** for a clean business (or run `npm run db:seed` against prod only if you want demo data).

## Live modules

Auth, Products, Inventory, POS (split pay), Stock check, Receive, Customer pay, Dashboard, Accounting, Tax, Banking, Notifications, Reports, Branches, Warehouse, Purchasing, Customers, Procurement, Loyalty, BI, Security, Payroll, Settings, AI assistant, Integrations, User Management, Global search, Invites.

### Key write flows

| Action | Where |
|--------|--------|
| Sell / split pay | Counter → Sell |
| Add product | Products → **Add product** |
| Adjust stock | Inventory → **Adjust stock** |
| Generate / create POs | Procurement / Purchasing |
| Invite staff | User Management → **Invite user** |
| First-run | `/setup` (empty DB only) |
