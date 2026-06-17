# Security model

- Every mutation requires an authenticated local user and an explicit role check.
- Tenant-owned records are queried with both record ID and company or buyer ownership.
- Company suspension disables profile publication and all company mutations.
- Quote, proposal-send, invoice-send, and payment-record endpoints require idempotency keys.
- File uploads accept JPEG, PNG, WebP, and PDF only, enforce a 20 MB content length, inspect magic bytes, and use private R2 objects.
- Logs contain request IDs, route names, status, and actor IDs; message bodies, addresses, tokens, and invoice details are excluded.
- Secrets are configured with Cloudflare secret bindings and never committed.
- Public forms are designed for Turnstile and per-IP rate limits.

Security-sensitive production changes require review, preview validation, and an audit event.
