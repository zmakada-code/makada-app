# Makada Properties — Internal App (Phase 1)

Private family/admin tool for the Makada rental portfolio. TurboTenant stays
responsible for rent payment processing; everything else lives here.

## Phase 1 status

This is the scaffold only:

- Next.js App Router + TypeScript + Tailwind
- Supabase auth (email magic link, allowlist-gated)
- Prisma schema for all eight records
- Left sidebar dashboard shell with topbar + placeholder global search
- Empty-state pages for every section
- Middleware that redirects unauthenticated (or non-allowlisted) users to /login

No CRUD, no payments, no Chrome-scraping of TurboTenant. That comes in later phases.

## Getting started

```bash
# 1. Install
npm install

# 2. Copy env, fill in Supabase + allowlist
cp .env.example .env
#    edit .env:
#    DATABASE_URL, DIRECT_URL  -> Supabase Postgres connection strings
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
#    ALLOWED_EMAILS="you@example.com,spouse@example.com"

# 3. Push the schema to Supabase
npx prisma db push
npx prisma generate

# 4. Run it
npm run dev
```

Then open http://localhost:3000 — you'll be bounced to `/login`. Enter an
allowlisted email, click the magic link, and you land in the dashboard.

## Supabase setup (one-time)

1. Create a new Supabase project.
2. Copy the Postgres connection string into `DATABASE_URL` and `DIRECT_URL`.
3. Copy the project URL + anon key into the `NEXT_PUBLIC_SUPABASE_*` vars.
4. Under **Authentication → Providers**, enable **Email**.
5. Under **Authentication → URL Configuration**, add
   `http://localhost:3000/auth/callback` (and your production URL later) to
   the allowed redirect list.
6. Under **Storage**, create a private bucket called `documents` — we'll wire
   it up in Phase 4.

No public signup. The allowlist (`ALLOWED_EMAILS`) is enforced in both the
middleware and the auth callback, so anyone who signs in with a non-approved
email is immediately signed back out.

## Roadmap

- **Phase 1** (this) — scaffold, auth, schema, empty pages
- **Phase 2** — Properties + Units CRUD, seed your 25 units
- **Phase 3** — Tenants + Leases, ending-soon filters
- **Phase 4** — Maintenance tickets + document uploads
- **Phase 5** — Inquiries + public-site handoff
- **Phase 6** — Global search, lightweight PaymentStatus + TurboTenant links, polish
