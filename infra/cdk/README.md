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
| `Ams-Observability` | CloudWatch dashboard (`ams-operations`) + P1/P2 alarms (ALB 5xx, p95 latency, no healthy hosts, Aurora CPU, queue age) → one SNS ops topic |
| `Ams-Edge` | CloudFront distribution (S3-hosted SPA by default, `/api/*` proxied to the ALB), a private SPA bucket, and an AWS-managed WAF WebACL attached to the ALB |

Deploying the app then means: push the API image to the `ams-api` ECR repo (see `apps/api/Dockerfile`),
`cdk deploy --all`, then publish the built Angular SPA to the `Ams-Edge` web bucket and invalidate
CloudFront. `.github/workflows/deploy.yml` does all of this (see below).

## What's deliberately not here yet

- **API Gateway (REST + WebSocket)** — CloudFront + the ALB cover HTTPS ingress and SPA hosting;
  a dedicated API Gateway (custom REST throttling, the WebSocket API for the live workshop board)
  is still a follow-up once those usage patterns are known. The WebSocket board currently rides
  the ALB via Socket.IO.
- **Custom domain + Route 53 + ACM** — `Ams-Edge` serves on the default CloudFront domain. Supply
  `-c domainName=ams-app.co.uk -c hostedZoneId=Z...` to wire a real hosted zone + cert once the
  domain exists; without it the stack still synthesizes and deploys.
- **CloudFront-scoped WAF** — the WAF WebACL is `REGIONAL` and attached to the ALB (where requests
  terminate). A second CloudFront-scoped ACL (which must live in `us-east-1`) can be added if edge
  filtering ahead of the origin is wanted.
- **Lambda functions** (Vehicle Update Handler, report generation) — `apps/workers` is where these
  would live; none exist yet because the equivalent logic currently runs as NestJS services in
  `apps/api` (see `RisImportService`, `WorkflowsService`) and the `batch-jobs` scheduler.
- **X-Ray tracing, Cognito Lambda triggers** — deferred; the dashboard + alarm pass above covers
  the spec's alerting table, but distributed tracing and auth-flow customisation are a later pass.

## CI/CD

`.github/workflows/deploy.yml` defines a GitHub Actions pipeline: **verify** (lint/test/build) on
every push, then on `main` a **deploy** job that assumes an AWS role via OIDC, builds & pushes the
API image to ECR, runs `cdk deploy --all`, and syncs the built SPA to S3 + invalidates CloudFront.
It is committed but **not yet run** — it needs an AWS account and the secrets/variables documented
at the top of the workflow file (`AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `WEB_BUCKET_NAME`,
`CLOUDFRONT_DISTRIBUTION_ID`). Likewise `apps/api/Dockerfile` is the intended API image but has not
been built here (no Docker daemon in the build sandbox).

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
