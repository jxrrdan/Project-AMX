# Security

This document covers how AMX handles its unauthenticated ("public") endpoints, what was reviewed, what has been fixed, what is still open, and how to run [Google Mantis](https://github.com/google/mantis) against the codebase.

## 1. Public endpoints

A dealership SaaS needs a few routes that work without a login: website enquiry forms, customer booking widgets, the customer's health-check approval link, and machine-to-machine webhooks. Every route marked `@Public()` is listed here with its protection. **Anything new marked `@Public()` must be added to this table.**

| Endpoint | Purpose | Protection |
|---|---|---|
| `POST /auth/login` | Sign in | Throttle 10/min/IP, generic "Invalid credentials" (no dealer enumeration), MFA |
| `POST /auth/refresh`, `/auth/logout` | Token lifecycle | Throttle 30/min/IP, opaque single-use refresh token |
| `POST /users/accept-invitation` | Invited user sets a password | Throttle 10/min/IP, random single-use expiring token, 12+ char password, response no longer echoes the user record |
| `GET /public/captcha` | Issue a CAPTCHA challenge | Global throttle |
| `POST /dealers/:id/enquiries` | Website enquiry form | CAPTCHA, throttle 5/min/IP, dealer must exist |
| `POST /public/booking/:id` | Online booking portal | CAPTCHA, throttle 5/min/IP, dealer must exist |
| `POST /dealers/:id/service-bookings` | Booking widget | CAPTCHA, throttle 5/min/IP, dealer must exist, field length limits |
| `POST /dealers/:id/chatbot` | Customer chatbot (billable AI) | CAPTCHA, throttle 10/min/IP, 1,000-char message cap, conversations scoped to the dealer and chatbot channel |
| `GET /vhc/inspections/:id/report` | Customer health-check report | Signed HMAC token in the link, throttle, internal ids stripped from the response |
| `PATCH /vhc/items/:id/respond` | Customer approves/declines | Same signed token, one answer per item (stops duplicate job cards), throttle |
| `GET /workshop-board/:token` | Workshop TV board | Long random token, throttle |
| `POST /integrations/webhooks/:token` | OEM / DMS webhooks | Random token, optional shared-secret header (timing-safe comparison), throttle |
| `GET /integrations/_sample-oem-feed/vehicles` | Demo fixture | Returns 404 when `NODE_ENV=production` |

Dealer IDs are not secret (they appear in widget URLs), so they are never treated as authorisation. Every authenticated route is dealer-scoped from the JWT, not from client input.

### Changes made in the latest review

1. Global rate limiting with `@nestjs/throttler` (300 requests/min/IP), with stricter per-route limits above. Previously there was none.
2. CAPTCHA added to the service-booking widget and chatbot.
3. VHC links now carry an HMAC token. A bare UUID is an identifier, not a secret. `respondToItem` also checks the token against the item's own inspection, and an item can only be answered once.
4. Chatbot conversation lookup is scoped to the dealer and channel (it was a bare id lookup, so a conversation id from another tenant could be read or appended to).
5. Webhook shared-secret header compared with `timingSafeEqual`.
6. Sample OEM feed disabled in production.
7. Login no longer reveals whether a dealer subdomain exists.
8. `accept-invitation` no longer returns the user entity (it contained `passwordHash`), and enforces a minimum password length.
9. Public endpoints return 404 for unknown dealers instead of a database error.

## 2. Already in place

Helmet security headers, CORS restricted to `CORS_ORIGIN`, a global `ValidationPipe` with `whitelist`, permission-matrix RBAC on every authenticated route, bcrypt (cost 12) password hashing, TOTP MFA, short-lived JWT access tokens with revocable refresh sessions, login audit trail, SSRF guard on admin-configured outbound URLs, timing-safe CAPTCHA signature checks.

## 3. Production checklist (deployment config, not code)

- [ ] Replace every dev default in `.env.example`: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CAPTCHA_SECRET`, `VHC_LINK_SECRET`, `AWP_WEBHOOK_SECRET`. Store them in AWS Secrets Manager.
- [ ] Set `CAPTCHA_DRIVER=turnstile` with `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET`. The local arithmetic CAPTCHA only deters casual spam.
- [ ] Set `TRUST_PROXY=true` behind ALB/CloudFront, otherwise every request appears to come from the load balancer and shares one rate-limit bucket.
- [ ] Set `NODE_ENV=production` and `CORS_ORIGIN` to the real web origin only.
- [ ] Put AWS WAF in front of the API (managed rule sets plus an IP rate rule).
- [ ] The default throttler store is in-memory per instance. With more than one API instance, back it with Redis (`@nest-lab/throttler-storage-redis`) so limits are shared.
- [ ] Give each integration webhook a `requiredHeaderName` / `requiredHeaderValue` shared secret.
- [ ] Serve `/storage` from S3 with signed URLs. The local static route is for development only.

## 4. Second hardening pass

| Issue | Fix |
|---|---|
| **Live-update WebSocket trusted unsigned tokens** (`jwt.decode`) and allowed any origin, so anyone could forge a `dealerId` and stream another dealer's job-card events | Tokens are now verified with `JWT_ACCESS_SECRET`; Socket.IO CORS uses the same `CORS_ORIGIN` allow-list as the REST API. Unit tested, including forged and `alg: none` tokens |
| No per-account brute-force protection | Account lockout, counted from `LoginAudit` and reset by a successful login. Configurable: `AUTH_MAX_FAILED_LOGINS` (default 5) and `AUTH_LOCKOUT_MINUTES` (default 15; any number of minutes, or `0` / `indefinite` to stay locked until an administrator calls `POST /users/:id/unlock`) |
| Refresh tokens stored in plain text | Stored as SHA-256 digests. **Existing sessions are invalidated on deploy; users sign in again** |
| SSRF via DNS rebinding / redirects | Outbound calls (OEM connectors, REST polling, action triggers) now use agents that validate the resolved IP at connect time, and redirects are disabled |
| VHC links never expired | Tokens now carry a 30-day expiry inside the signature |
| Vulnerable dependencies | `npm audit fix` plus axios upgraded to 1.20 (clears the high/critical items in runtime code paths) |

### Production hardening (deployment pass)

- API refuses to boot in production on dev/short secrets, wildcard or localhost CORS, or mock drivers (`production-config.ts`, tested).
- CloudFront now sets HSTS, CSP, frame, referrer and content-type headers on the SPA and files; nginx mirrors them locally.
- API container runs as a non-root user, with a health check; images are scanned on push; `.dockerignore` keeps `.env` out of images.
- Secrets are generated by Secrets Manager and injected at runtime, never in the task definition.
- Server-side PDF rendering runs Chromium with JavaScript disabled and all network requests blocked.
- CloudFront no longer rewrites API 403/404 responses into a 200 page.
- `npm audit --omit=dev --audit-level=critical` gates every pull request in CI.

### Still open

- `@angular/router` (SSR-only denial-of-service advisory; AMX does not use SSR) needs the whole Angular set bumped to 22.2.x together.
- `prisma` CLI's transitive `@prisma/config` / `deepmerge-ts` advisories are build-time tooling only; npm's suggested "fix" is a downgrade, so it is left.
- Run `npm audit --omit=dev` in CI and review monthly.
- Run Mantis (below) and an external penetration test before go-live.

## 5. Running Google Mantis against AMX

[Mantis](https://github.com/google/mantis) is a separate, experimental multi-agent security-review tool from Google. It reads code and reports suspected vulnerabilities. It is not part of AMX and is not an officially supported Google product, so **treat every finding as a lead to verify by hand, not a confirmed bug.**

Requirements: Linux or WSL2 (not native Windows) and Python 3.12+. A Google Cloud project is **not** required: Mantis talks to models through LiteLLM and also accepts a Gemini API key, an Anthropic key, an OpenAI key or any OpenAI-compatible endpoint (including a local Ollama). Model calls are billed to whichever account owns the key, so set a spending limit first.

### Without Google Cloud

Skip `gcloud auth application-default login` and export one key instead:

```bash
export GEMINI_API_KEY=...        # free-tier key from Google AI Studio, no GCP project needed
# or: export ANTHROPIC_API_KEY=...   and run with  --model anthropic/<model-name>
# or: export OPENAI_API_KEY=...      and run with  --model openai/<model-name>
# or: a local/self-hosted model:     --model openai/<name> --api-base http://localhost:11434/v1
python3 scripts/configure.py --auto
python3 scripts/configure.py --test --probe
./run.sh ~/amx-review/apps/api/src --sandbox static-only --focus "authorisation and tenant isolation"
```

`--sandbox static-only` reads the code without executing anything, which is the right mode when you have no GCE or microVM sandbox. Without a sandbox Mantis cannot try its proof-of-concept exploits, so expect more false positives to triage by hand. Free-tier Gemini keys are rate limited; use a small target and a low `--parallel`. A local model is private and free but noticeably weaker at security reasoning.

### With Google Cloud (Vertex AI)

```bash
# 1. Install (WSL2 Ubuntu shown)
sudo apt update && sudo apt install -y python3-venv git
git clone https://github.com/google/mantis ~/mantis
cd ~/mantis/reference && ./install.sh

# 2. Authenticate to Google Cloud (Vertex AI)
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID

# 3. Configure and check connectivity
python3 scripts/configure.py --auto
python3 scripts/configure.py --test --probe

# 4. Run against AMX (a throwaway copy, not your working tree)
cp -r ~/Project-AMX ~/amx-review && rm -rf ~/amx-review/node_modules ~/amx-review/.git ~/amx-review/.env
./run.sh ~/amx-review/apps/api/src --focus "authentication, IDOR and tenant isolation, public @Public endpoints, SSRF in outbound URLs"
```

Useful variations:

```bash
./run.sh ~/amx-review/apps/api/src/modules/vhc --objective "Audit public token-gated endpoints for authorisation bypass"
./run.sh ~/amx-review/apps/api/src --objective "Audit for SSRF in webhook and REST_PULL handlers" --inspect --dry-run   # preview the plan first
./run.sh ~/amx-review/apps/api/src --parallel 8                                                                          # faster, costs more
```

Good practice:

- Run it in an isolated environment (a spare WSL distro or VM), never with production credentials or a real `.env` present.
- Scan `apps/api/src` first (the backend holds the authorisation logic). Scanning the whole monorepo including `node_modules` is slow and expensive.
- Start with a focused run on one module, check the cost, then widen.
- For each finding: reproduce it, fix it, add a unit test, then note it in this document.
