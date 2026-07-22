# RBIAP — Retail Business Intelligence & Accounting Platform

Retail OS for shops: Counter Mode (sell / stock check / receive / customer pay), inventory, purchasing, accounting, tax, BI, and alerts.

## Stack

- Next.js 16 · React 19 · TypeScript · Tailwind CSS 4
- Prisma 6 · **PostgreSQL (Neon)**
- Auth.js (NextAuth v5) · Zod · bcryptjs · html5-qrcode

## Architecture (important)

RBIAP is a **full-stack Next.js** app: the UI, Auth.js, and server actions share one process.

| Piece | Where it runs |
|-------|----------------|
| Database | **Neon** (PostgreSQL) |
| App (UI + server/API) | **Vercel** (recommended) **or** **Render** Web Service |

You do **not** need Vercel for frontend *and* Render for backend at the same time for this repo. Pick **one** app host + Neon. `vercel.json` and `render.yaml` are both included so you can use either.

## Local setup

1. Create a Neon project and copy the **pooled** connection string.
2. Configure env:

```bash
npm install
cp .env.example .env
```

Set in `.env`:

- `DATABASE_URL` → Neon URL  
- `AUTH_SECRET` → `openssl rand -base64 32`  
- `AUTH_URL` → `http://localhost:3000`

3. Create tables and run:

```bash
npm run db:push
npm run dev
```

Open http://localhost:3000 → **`/setup`** creates your business and owner account.

### Optional demo data

```bash
npm run db:seed    # "Kigali Fresh" sample tenant
# or
npm run db:reset   # wipe + seed
```

Demo login (seed only): `jean@kigalifresh.rw` / `demo1234`

## Optional SMTP

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=RBIAP <noreply@yourbusiness.com>
AUTH_URL=https://your-production-url
```

Without SMTP, admins still get a copyable invite / reset link.

## Deploy on Vercel (recommended)

1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Environment variables:

| Variable | Required | Value |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Neon pooled URL |
| `AUTH_SECRET` | Yes | long random secret |
| `AUTH_URL` | Yes | `https://your-app.vercel.app` |
| `SMTP_*` | No | email invites / resets |

4. Deploy. `vercel.json` runs `prisma generate && prisma db push && next build`.
5. Open the URL → complete **`/setup`**.

## Deploy on Render (alternative to Vercel)

1. [render.com](https://render.com) → **New** → **Blueprint** (uses `render.yaml`), or **Web Service** from the repo.
2. Set the same env vars (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL=https://your-service.onrender.com`).
3. Free tier sleeps when idle; first request after sleep can be slow.
4. Open the service URL → **`/setup`**.

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
