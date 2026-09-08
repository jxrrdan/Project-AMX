# AMS — Agent Management System

A modular SaaS system for BMW dealers operating under the agency sales model, implementing the
16 modules of the **AMS Feature Specification v3.1**: PDI scheduling, workshop management, parts
stock, used car sales, warranty, CRM, VHC, third-party listings, accounting, courtesy fleet, F&I,
and AI insights.

## What this is

A **runnable local MVP + full architecture scaffold**, built by Claude Code from the feature
spec PDF. Concretely:

- **Fully working end-to-end** (real UI + API + database, verified in a browser): Module 7
  (auth, multi-tenancy, RBAC), Module 2 (Workshop Scheduling, with live WebSocket updates), and
  Module 1 (New Car Stock & PDI Pipeline, with a drag-and-drop kanban board).
- **Working API + basic UI for every other module** (3, 4, 5, 6, 8–16): real Prisma-backed CRUD,
  business rules from the spec (e.g. warranty's mandatory 3Cs before submission, FCA disclosure
  logging, VHC's mandatory photo-on-Amber/Red), and a functional Angular page per module — but
  without the same UI polish as the three modules above.
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

Every one of these is a small, isolated class — swapping the local branch for a real AWS call is
a contained change, not a rewrite.

## What's deliberately not built

- **Full nurture-workflow branching** (Module 8.9) — the workflow runner executes sequential
  steps (send email/SMS, create task, change stage) on a timer; the condition/branch step type
  from the spec's builder isn't implemented.
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
