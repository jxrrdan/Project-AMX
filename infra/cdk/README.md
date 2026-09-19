# AMS — AWS CDK Infrastructure

Structural scaffold of the production architecture described in the AMS Feature Specification
v3.1. It **synthesizes cleanly** (`npm run synth`) but has **not been deployed** — there's no AWS
account wired to this repo, and several pieces are intentionally left as follow-up work rather
than guessed at.

## What's here

| Stack | Contents |
|---|---|
| `Ams-Network` | VPC — public / private-with-egress / private-isolated subnets across 2 AZs |
| `Ams-Data` | Aurora PostgreSQL Serverless v2 (writer + reader), ElastiCache Redis replication group |
| `Ams-Auth` | Cognito user pool with a `dealerId` custom attribute, email sign-in, optional MFA |
| `Ams-Storage` | S3 bucket for dealer files (photos, PDFs, documents), versioned, Glacier lifecycle rule |
| `Ams-Queue` | SQS queue + DLQ for the BMW RIS vehicle-update pipeline, EventBridge bus, DLQ-depth alarm |
| `Ams-Compute` | ECS Fargate cluster: the NestJS API behind an ALB, and the always-on MQTT Subscriber service |

## What's deliberately not here yet

- **API Gateway (REST + WebSocket) and WAF** — the local dev API talks to the ALB directly;
  fronting it with API Gateway per the spec is a follow-up stack once real usage patterns
  (custom domains, throttling needs) are known.
- **CloudFront + Route 53** — needs a real hosted zone and ACM certificate for `ams-app.co.uk`;
  wiring this up against a domain nobody owns yet would just be guesswork.
- **Lambda functions** (Vehicle Update Handler, report generation, cron jobs) — `apps/workers` in
  the Nx workspace is where these would live; none exist yet because the equivalent logic
  currently runs as NestJS services in `apps/api` (see `RisImportService`, `WorkflowsService`)
  for local development.
- **X-Ray tracing, CloudWatch dashboards/alarms beyond the one DLQ alarm, WAF rules, Cognito
  Lambda triggers** — the observability section of the spec is extensive; this scaffold wires up
  the one alarm explicitly called out as P1 (DLQ depth) and leaves the rest for a dedicated pass.
- **CI/CD (GitHub Actions → ECR → ECS)** — no pipeline is defined; images referenced by
  `Ams-Compute` (`ams-api`, `ams-mqtt-subscriber`) must be pushed to the ECR repos this stack
  creates before a deploy would succeed.

## Running this

```bash
cd infra/cdk
npm install
npm run synth   # validates the stacks — no AWS credentials required
npm run diff    # requires AWS credentials + a bootstrapped account
npm run deploy  # requires AWS credentials + a bootstrapped account — NOT run by this repo
```

This is a standalone npm project (its own `package.json`, outside the Nx workspace) because CDK
apps have their own release cadence and dependency graph from the rest of the monorepo.
