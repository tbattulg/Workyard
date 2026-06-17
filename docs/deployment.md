# Cloudflare deployment

## Isolated resources

- Pages project: `workyard-mvp`
- Pages domain: `workyard-mvp.pages.dev`
- Preview D1: `workyard-db-preview` (`ea7c8407-3717-408d-8392-e15b4b064e89`)
- Production D1: `workyard-db-production` (`ee9335f0-7089-4c20-b4ae-bfb079cb2795`)
- Preview R2: `workyard-files-preview` (blocked until R2 is enabled)
- Production R2: `workyard-files-production` (blocked until R2 is enabled)

Do not reuse or modify the existing Invoice Maker Pages project or D1 database.

## Required setup

1. Enable R2 in the Cloudflare dashboard.
2. Create the preview and production R2 buckets.
3. Bind `FILES` separately in preview and production.
4. Add Clerk, Resend, Mapbox, Sentry, and Turnstile values as encrypted secrets.
5. Apply migrations to preview, verify the preview deployment, then apply to production.

## Completed setup

- `workyard-mvp` Pages project is connected to `tbattulg/Workyard` with Git deployments.
- Production branch is `main`.
- Build command is `npm run build`; output directory is `dist`.
- Preview and production Pages environments have separate `DB` bindings.
- Public build variables are set for the neutral display brand and Chicago pilot.

## Remaining setup

1. Replace placeholder `SUPPORT_EMAIL` / URL values with the launch domain and support inbox.
2. Enable R2 and bind `FILES` to `workyard-files-preview` and `workyard-files-production`.
3. Add the encrypted provider secrets:
   - `CLERK_SECRET_KEY`
   - `CLERK_JWT_KEY`
   - `RESEND_API_KEY`
   - `MAPBOX_SECRET_TOKEN`
   - `SENTRY_DSN`
   - `TURNSTILE_SECRET_KEY`

## Release gates

- `npm run check` and `npm run test:e2e` pass.
- Preview smoke tests cover search, quote, proposal, job, invoice, review, and moderation.
- D1 Time Travel restore procedure is rehearsed.
- Email SPF, DKIM, and DMARC pass.
- Legal drafts have been reviewed and replaced where required.
- R2 remains private and cross-company file access tests fail securely.

## Recovery

D1 Time Travel provides seven days of recovery on the free Workers plan. Export production data periodically for longer retention. Restore commands are destructive and require an incident ticket, a recorded bookmark, and two-person approval.
