# Workyard

Workyard is a U.S.-wide construction services marketplace. The public brand is configured with `VITE_PUBLIC_APP_NAME`.

Workyard connects buyers with manually verified trade businesses, carries a project from quote request through proposal and job tracking, and produces itemized post-work invoices. It does not process payments.

## Stack

- React, TypeScript, Vite, React Router, TanStack Query
- Hono API in Cloudflare Pages Functions
- Cloudflare D1 and private R2 storage
- Drizzle ORM, Zod, Clerk, Resend, Mapbox, pdf-lib
- Vitest, Playwright, ESLint, Prettier

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the public development keys.
3. Copy the server secrets to `.dev.vars`.
4. Run `npm run db:migrate:local`.
5. Run `npm run dev` for the frontend or `npm run build && npm run pages:dev` for the full Pages runtime.

Without Clerk keys the app enters a clearly labeled local demo session. Production rejects demo authentication.

## Validation

Run `npm run check` before committing. End-to-end tests use `npm run test:e2e`.

## Deployment

Deployment is documented in `docs/deployment.md`. Cloudflare resources are isolated from the existing Invoice Maker project.

## Legal status

The included legal pages are implementation drafts and are not legal advice. They must be reviewed before public launch.
