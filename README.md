# RBIAP — Retail Business Intelligence & Accounting Platform

Retail OS for shops: Counter Mode, inventory, purchasing, accounting, tax, BI, and alerts.

## Architecture

| Piece | Host | Role |
|-------|------|------|
| **Database** | **Neon** (PostgreSQL) | Data |
| **API** | **Render** (Express) | Auth JWT, Prisma, business logic (`/rpc`) |
| **Web** | **Vercel** (Next.js) | UI; calls Render via `API_URL` |

```
Browser → Vercel (UI) → Render API → Neon DB
```

## Local setup

### Option A — monolith (simplest)

Leave `API_URL` empty. Next.js talks to Neon directly.

```bash
npm install
cp .env.example .env
# Set DATABASE_URL (Neon), AUTH_SECRET, AUTH_URL=http://localhost:3000
npm run db:push
npm run dev
```

### Option B — split like production

```bash
# Terminal 1 — API
# .env: DATABASE_URL, AUTH_SECRET, WEB_ORIGIN=http://localhost:3000, PORT=4000
npm run dev:api

# Terminal 2 — Web
# .env: API_URL=http://localhost:4000, NEXT_PUBLIC_API_URL=http://localhost:4000,
#       AUTH_SECRET (same), AUTH_URL=http://localhost:3000
# (no DATABASE_URL needed on web)
npm run dev
```

Open http://localhost:3000 → **`/setup`**.

## Deploy (connect the three)

### 1. Neon

Create a project → copy the **pooled** connection string.

### 2. Render (API)

1. New → Blueprint (this repo’s `render.yaml`) or Web Service.
2. Root directory: repo root.
3. Build: `npm install && npx prisma generate && npx prisma db push`
4. Start: `npm run start:api`
5. Env vars:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon URL |
| `AUTH_SECRET` | long random (`openssl rand -base64 32`) |
| `WEB_ORIGIN` | your Vercel URL (set after step 3, or update) |
| `PORT` | `4000` |

6. Note the API URL, e.g. `https://rbiap-api.onrender.com`  
7. Check `https://rbiap-api.onrender.com/health` → `{ ok: true }`.

### 3. Vercel (Web)

1. Import the same GitHub repo.
2. Env vars:

| Key | Value |
|-----|--------|
| `API_URL` | `https://rbiap-api.onrender.com` |
| `NEXT_PUBLIC_API_URL` | same as `API_URL` |
| `AUTH_SECRET` | **same** as Render |
| `AUTH_URL` | `https://your-app.vercel.app` |

3. Deploy (no `DATABASE_URL` on Vercel).
4. Set Render `WEB_ORIGIN` to the Vercel URL and redeploy API if needed.
5. Open the Vercel URL → **`/setup`**.

## Optional SMTP

Set `SMTP_*` on **Render** (API sends invite/reset emails). Set `AUTH_URL` to the **Vercel** public URL so links open the web app.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js web |
| `npm run dev:api` | Express API on `:4000` |
| `npm run start:api` | Production API entry |
| `npm run db:push` | Sync Prisma schema to Neon |
| `npm run db:seed` | Demo tenant (optional) |

## Live modules

Auth, Products, Inventory, POS, Stock check, Receive, Customer pay, Dashboard, Accounting, Tax, Banking, Notifications, Reports, Branches, Warehouse, Purchasing, Customers, Procurement, Loyalty, BI, Security, Payroll, Settings, AI assistant, Integrations, User Management, Global search, Invites.
