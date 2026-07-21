# RBIAP — Retail Business Intelligence & Accounting Platform

Retail OS for shops: Counter Mode (sell / stock check / receive / customer pay), inventory, purchasing, accounting, tax, BI, and alerts.

## Stack

- Next.js 16 · React 19 · TypeScript · Tailwind CSS 4
- Prisma 6 · **SQLite** (local — default)
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
