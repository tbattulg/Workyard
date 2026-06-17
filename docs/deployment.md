# Cloudflare deployment

## Isolated resources

- Pages project: `workyard-mvp`
- Preview D1: `workyard-db-preview`
- Production D1: `workyard-db-production`
- Preview R2: `workyard-files-preview`
- Production R2: `workyard-files-production`

Do not reuse or modify the existing Invoice Maker Pages project or D1 database.

## Required setup

1. Enable R2 in the Cloudflare dashboard.
2. Create the preview and production D1 databases and R2 buckets.
3. Connect `tbattulg/Workyard` to the `workyard-mvp` Pages project.
4. Set `npm run build` as the build command and `dist` as the output directory.
5. Bind `DB` and `FILES` separately in preview and production.
6. Add Clerk, Resend, Mapbox, Sentry, and Turnstile values as encrypted secrets.
7. Apply migrations to preview, verify the preview deployment, then apply to production.

## Release gates

- `npm run check` and `npm run test:e2e` pass.
- Preview smoke tests cover search, quote, proposal, job, invoice, review, and moderation.
- D1 Time Travel restore procedure is rehearsed.
- Email SPF, DKIM, and DMARC pass.
- Legal drafts have been reviewed and replaced where required.
- R2 remains private and cross-company file access tests fail securely.

## Recovery

D1 Time Travel provides seven days of recovery on the free Workers plan. Export production data periodically for longer retention. Restore commands are destructive and require an incident ticket, a recorded bookmark, and two-person approval.
