# Security model

- Every mutation requires an authenticated local user and an explicit role check.
- Tenant-owned records are queried with both record ID and company or buyer ownership.
- Company suspension disables profile publication and all company mutations.
- Quote, proposal-send, invoice-send, and payment-record endpoints require idempotency keys.
- File uploads are deferred while R2 is not in current scope. If uploads are re-enabled, they must use private storage, strict type validation, size limits, and authorization-checked download routes.
- Logs contain request IDs, route names, status, and actor IDs; message bodies, addresses, tokens, and invoice details are excluded.
- Secrets are configured with Cloudflare secret bindings and never committed.
- Public forms are designed for Turnstile and per-IP rate limits.

Security-sensitive production changes require review, preview validation, and an audit event.
