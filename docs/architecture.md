# Architecture

## Boundaries

The browser is an untrusted client. Pages Functions validate Clerk sessions, derive Workyard roles from D1, enforce company ownership on every query, and return only authorized records. Public company and service searches expose approved profile fields only.

The current application scope uses one D1 database per environment. File storage through R2 is deferred; upload routes remain unavailable unless a future release binds private object storage. Invoices are stored as application records and sent as email/dashboard notifications without generated PDF files.

## Domain lifecycle

- Company: `draft`, `pending`, `verified`, `rejected`, `suspended`
- Quote: `new`, `viewed`, `responded`, `accepted`, `declined`, `expired`, `converted`
- Proposal: `draft`, `sent`, `accepted`, `declined`, `expired`, `withdrawn`
- Job: `accepted`, `scheduled`, `in_progress`, `awaiting_invoice`, `invoiced`, `paid`, `closed`, `cancelled`
- Invoice: `draft`, `sent`, `viewed`, `overdue`, `paid`, `void`

Transitions are validated centrally and appended to history tables. Sent invoices are immutable; corrections create a revision.

Contractors create or edit a structured company draft with business details, license number,
service categories, and U.S. service states. Submitting the profile moves it to `pending` without
requiring file uploads. Platform admins approve pending companies into public `verified` status,
request changes by returning them to `rejected`, or suspend companies. Verification decisions are
recorded in audit events. Public marketplace search only returns verified, non-deleted companies.

## Money and time

Money is stored as integer cents. Tax, discount, and retainage rates use basis points. Quantities use thousandths. All timestamps are UTC ISO strings. User-facing dates are rendered in the account locale.

## Identity and tenancy

Clerk is the identity provider. D1 stores the local user profile, platform role, company memberships, assignments, and suspension state. A user may be a buyer and also belong to one or more companies.

Platform administrators can moderate across tenants. Company administrators manage their company. Staff can access assigned work and company conversations but cannot send invoices.
