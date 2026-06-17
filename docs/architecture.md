# Architecture

## Boundaries

The browser is an untrusted client. Pages Functions validate Clerk sessions, derive Workyard roles from D1, enforce company ownership on every query, and return only authorized records. Public company and service searches expose approved profile fields only.

The application uses one D1 database and one private R2 bucket per environment. Files are represented by metadata rows before upload and can only be downloaded through short-lived, authorization-checked API routes.

## Domain lifecycle

- Quote: `new`, `viewed`, `responded`, `accepted`, `declined`, `expired`, `converted`
- Proposal: `draft`, `sent`, `accepted`, `declined`, `expired`, `withdrawn`
- Job: `accepted`, `scheduled`, `in_progress`, `awaiting_invoice`, `invoiced`, `paid`, `closed`, `cancelled`
- Invoice: `draft`, `sent`, `viewed`, `overdue`, `paid`, `void`

Transitions are validated centrally and appended to history tables. Sent invoices are immutable; corrections create a revision.

## Money and time

Money is stored as integer cents. Tax, discount, and retainage rates use basis points. Quantities use thousandths. All timestamps are UTC ISO strings. User-facing dates are rendered in the account locale.

## Identity and tenancy

Clerk is the identity provider. D1 stores the local user profile, platform role, company memberships, assignments, and suspension state. A user may be a buyer and also belong to one or more companies.

Platform administrators can moderate across tenants. Company administrators manage their company. Staff can access assigned work and company conversations but cannot send invoices.
