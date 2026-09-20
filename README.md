# AMS — Agent Management System

A modular SaaS system for BMW dealers operating under the agency sales model, implementing the
16 modules of the **AMS Feature Specification v3.1**: PDI scheduling, workshop management, parts
stock, used car sales, warranty, CRM, VHC, third-party listings, accounting, courtesy fleet, F&I,
and AI insights.

## What this is

A **runnable local MVP + full architecture scaffold**, built by Claude Code from the feature
spec PDF. Concretely:

- **Fully working end-to-end** (real UI + API + database, verified in a browser) for every one of
  the 16 modules — not just read-only lists, but the actual create/edit/detail workflows the spec
  describes: drag-and-drop kanban boards (workshop diary, vehicle pipeline, lead pipeline), a
  DVLA reg lookup and itemised deal sheet for used cars, a public enquiry form and a contact
  detail view with activity timeline for CRM, warranty operation lines with the mandatory 3Cs and
  technician clocking, VHC inspections with a public customer approval report, parts movements
  and purchase orders, courtesy fleet bookings, F&I disclosure capture, and accounting
  reconciliation. Two public, unauthenticated pages exist purely because the spec calls for
  them: `/enquiry/:dealerId` (§8.1) and `/vhc-report/:id` (§9.2-9.3).
- **A complete Prisma schema** modelling all 16 modules' data (`apps/api/prisma/schema.prisma`),
  which is the actual source of truth for what data this system manages.
- **A synthesizable AWS CDK scaffold** (`infra/cdk`) mirroring the production architecture —
  VPC, Aurora Serverless v2, ElastiCache, Cognito, S3, ECS Fargate, SQS/EventBridge — with a
  README explaining exactly what's deployed-ready vs. left as follow-up.

AWS services with no equivalent available in a local dev sandbox (Cognito, MQTT ingest from BMW's
RIS broker, SES, SNS/Twilio, Bedrock) are implemented as **pluggable local adapters** behind the
same interface the production service would use — see [Local vs. production](#local-vs-production)
below. Everything else is real: real Postgres, real business logic, real HTTP calls between a
real Angular app and a real NestJS API.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Angular 22 (standalone components, zoneless change detection, Angular Material) |
| Backend | NestJS 11 (TypeScript / Node.js) |
| Monorepo | Nx 23 |
| Database | PostgreSQL (Aurora Serverless v2 in production) via Prisma 6 |
| Auth | JWT access/refresh tokens, TOTP MFA — mirrors Cognito's shape (see below) |
| Real-time | Socket.IO namespace for the live workshop board (API Gateway WebSocket + Redis pub/sub in production) |
| Infra-as-code | AWS CDK v2 (TypeScript), standalone project under `infra/cdk` |

The spec named Angular 18 and unspecified NestJS/Prisma majors; this build uses the current
stable major of each (Angular 22, NestJS 11, Prisma 6) rather than pinning to what was current
when the spec was written — there's no reason to start a new project on an already-superseded
version.

## Monorepo structure

```
apps/
  web/     — Angular SPA, one route per module
  api/     — NestJS application, one module per domain (apps/api/src/modules/*)
libs/
  shared/  — enums, DTOs, the permission matrix — imported by both web and api
infra/
  cdk/     — AWS CDK stacks (see infra/cdk/README.md)
docs/
  runbooks/ — the five operational runbooks named in the spec's alerting table
```

## Getting started

### Prerequisites

- Node.js 22+, npm
- A local PostgreSQL instance (or Docker, if your machine supports it — see below)
- Redis (optional for basic use; needed for multi-instance WebSocket pub/sub, which doesn't
  matter running a single instance locally)

### 1. Install dependencies

```bash
npm install
```

### 2. Start Postgres (and Redis, optional)

**With Docker** (if available on your machine):
```bash
docker compose up -d
```

**Without Docker** (e.g. this was built in a sandbox where Docker's daemon couldn't run — see
below): install PostgreSQL locally and create a database/user matching `.env.example`:
```sql
CREATE USER ams WITH PASSWORD 'ams_local_password' CREATEDB;
CREATE DATABASE ams OWNER ams;
```

### 3. Configure environment

```bash
cp .env.example .env
```

The defaults work for the local Postgres/Redis setup above. See the comments in `.env.example`
for what each local adapter driver does and how to point it at a real AWS service later.

### 4. Migrate and seed the database

```bash
npx prisma migrate deploy   # applies the committed migration in apps/api/prisma/migrations
npx prisma db seed          # creates a demo dealer, users, and sample data across every module
```

The seed prints demo login credentials — the short version:

| Field | Value |
|---|---|
| Subdomain | `bmwnorthampton` |
| Email | `principal@bmwnorthampton.ams-app.co.uk` (also `workshop@...`, `tech@...`) |
| Password | `Password123!` |

### 5. Run the app

```bash
npm run dev:api   # NestJS API at http://localhost:3000/api
npm run dev:web   # Angular app at http://localhost:4200
```

Log in with the credentials above. The sidebar shows every module the logged-in user's role has
`VIEW` permission on (Module 7's RBAC in action — try logging in as `tech@...` to see a much
shorter menu than `principal@...`).

To see the public, embeddable enquiry form (§8.1) — the thing a dealer's own website would embed
against — visit `http://localhost:4200/enquiry/<dealerId>` in a private/incognito window (no
login). Get the demo dealer's ID from `GET /api/dealers/me` while logged in, or from Prisma
Studio. Submitting it creates a real contact + lead you'll see land in the CRM contacts list and
lead pipeline.

## Local vs. production

Every AWS service this system depends on but that a local dev sandbox can't provide is behind an
explicit adapter interface, selected by an env var, so the exact same application code runs
locally and in production:

| Spec dependency | Local adapter | Production target |
|---|---|---|
| AWS Cognito | JWT + TOTP in `apps/api/src/modules/auth` | Cognito user pool (`infra/cdk/lib/auth-stack.ts`) |
| AWS S3 | Local filesystem (`StorageService`, `STORAGE_DRIVER=local`) | S3 bucket (`infra/cdk/lib/storage-stack.ts`) |
| AWS SES | Console log (`EmailService`, `EMAIL_DRIVER=console`) | SES |
| AWS SNS / Twilio | Console log (`SmsService`, `SMS_DRIVER=console`) | SNS or Twilio |
| Amazon Bedrock (Claude) | Deterministic mock (`AiService`, `AI_DRIVER=mock`) | Bedrock `InvokeModel`, per Module 14's spec |
| Handlebars → Puppeteer → PDF | Handlebars → HTML file (`PdfService`, `PDF_DRIVER=html`) — open in a browser and print-to-PDF to see the real output | Same template, rendered to an actual PDF via Puppeteer |
| BMW RIS MQTT ingest | A cron job that fabricates a plausible new order every 30 minutes (`RisImportService`) | Always-on MQTT subscriber (`infra/cdk/lib/compute-stack.ts`) → SQS → Lambda |
| AWP webhook integration | Mocked job references (`AWP-MOCK-...`) generated on PDI scheduling | Real webhook exchange with AWP |
| DVLA Vehicle Enquiry Service | Deterministic mock spec, seeded from the registration itself (`DvlaService`, `DVLA_DRIVER=mock`) — try the "Look up on DVLA" button on the Used Cars page | Real DVLA API (needs a government-issued API key) |

Every one of these is a small, isolated class — swapping the local branch for a real AWS call is
a contained change, not a rewrite.

## OEM Integration Hub (beyond the original spec)

A no-code data-connector layer, added on top of the 16 spec modules so a business systems manager
can wire up a manufacturer/DMS feed without writing code — `/integrations`:

- **Connectors** — REST pull (poll a URL on a schedule), REST push (an inbound webhook gated on an
  unguessable token), or MQTT streaming, each targeting one AMX entity (new car stock, used car
  stock, parts, or CRM contacts).
- **Authentication & headers** — Basic, Bearer, or API-key auth plus arbitrary custom headers per
  connector; a shared-secret header for inbound webhooks. Saved credentials are never round-tripped
  back to the browser (redact-on-read, merge-preserve-on-write, in `rest-auth.util.ts`).
- **Drag-and-drop field mapping** — paste a sample payload, discover its fields, then drag each one
  onto an AMX column or a dealer-defined **custom field** (stored per-record in a `customFields`
  JSON column), with optional transforms (uppercase/lowercase/trim/parse number/parse date) and a
  "match on" column to decide create-vs-update.
- **Screen Designer** (`/integrations/screens`) — lets a business systems manager choose which
  fields (standard or custom) appear on a record's detail page and in what order, per entity. A
  reusable `CustomFieldsPanelComponent` renders that layout and is embedded on the Used Cars, Parts,
  and Contact detail pages.
- **Run history and a "send test data" action** exercise the same mapping engine as a live
  webhook/poll/MQTT message would, without needing a real external system to talk to — no aedes/MQTT
  broker is embedded locally (it's ESM-only and would hit the same Jest/CJS problem noted above);
  "send test data" covers the same code path.

## Settings, batch jobs, and document templates (beyond the original spec)

`/admin/settings` — dealer master data and scheduled maintenance, mirroring gaps a real
multi-tenant SaaS product needs before go-live:

- **Dealer profile & branding** — name, address, VAT number, invoice footer note, a logo upload
  (base64 data URL → `StorageService`, no multipart pipeline needed), and primary/secondary
  colours applied live across the app shell (toolbar, sidenav active state) via a `ThemeService`
  that binds them as plain inline styles rather than fighting Angular Material's internal M3
  design tokens.
- **Document numbering** — per-dealer, per-document-type, per-year incrementing sequences (e.g.
  `DS-2026-00001`), reserved atomically in a transaction (`DocumentSequenceService`).
- **Batch jobs** — nightly stale-lead escalation and parts reorder alerts, plus a monthly courtesy
  fleet expiry sweep, each run per-dealer via `@nestjs/schedule` and logged to `BatchJobRun` (same
  audit-trail pattern as the Integration Hub's run logs). A "Run now" button demonstrates each job
  without waiting for its schedule. Output lands in a new in-app **notification centre** (bell icon
  in the toolbar) — the `Notification` table existed in the original schema but nothing wrote to
  it until now.
- **Document templates** — a dealer-authored HTML/CSS editor with an "insert variable" picker
  (mail-merge-style `{{placeholders}}` for dealer/document data, `{{#each}}`/`{{#if}}` for line
  items) and an approximate live preview. Wired end-to-end into the used-car deal sheet: if a
  dealer sets a template as default for that document type, it's used instead of the built-in
  fallback the next time a deal sheet is generated — proven with a real API call, not just UI.
  Only `ModuleKey.ADMIN:EDIT` users (Dealer Principal / General Manager) can author these, which is
  why rendering uses full Handlebars (like every other document in this app) rather than the
  restricted placeholder substitution the CRM SMS free-text path uses — that fix (§ security
  review) was specifically about a much lower-trust `CRM:CREATE` user submitting arbitrary text.

## What's deliberately not built

- **Real third-party integrations** — AutoTrader/Motors.co.uk (Module 10), Xero/Sage/QuickBooks
  (Module 11), Stripe billing (Module 7.6) are modelled in the schema and their sync/publish
  actions are mocked (mark-as-published/synced immediately) rather than calling real APIs nobody
  has test credentials for.
- **CloudFront/Route 53/API Gateway/WAF, Lambda workers, most of the observability stack beyond
  one alarm** — see `infra/cdk/README.md` for the full list and why.
- **Angular PWA / offline support** for PDI checklists — the spec calls for this explicitly
  (§Non-functional Requirements); the app is a standard SPA today.

## Development commands

```bash
npm run build          # nx run-many -t build   — builds shared, api, and web
npm run lint           # nx run-many -t lint
npm run test           # nx run-many -t test
npm run db:studio      # Prisma Studio — browse the database visually
```

Everything above passes clean on this repo as committed (build, lint, and test, across all three
Nx projects).

## License

GPL-3.0 — see [LICENSE](./LICENSE).
