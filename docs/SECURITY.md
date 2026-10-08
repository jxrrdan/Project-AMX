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

## 4. Known open items

- **Account lockout:** login is rate limited per IP, but there is no per-account lockout after repeated failures. Add one (e.g. 5 failures then a 15 minute cool-down) before go-live.
- **SSRF:** the outbound URL guard checks the literal hostname only, not the resolved IP (DNS rebinding). See `common/security/outbound-url.util.ts`.
- **Refresh tokens** are stored in plain text in `UserSession`. Hashing them would limit exposure from a database leak.
- **Socket.IO namespace** authentication and tenant room isolation need a dedicated review.
- **VHC link lifetime:** tokens do not expire. If that matters, add an expiry to the signed payload.
- **Dependencies:** run `npm audit` in CI.

## 5. Running Google Mantis against AMX

[Mantis](https://github.com/google/mantis) is a separate, experimental multi-agent security-review tool from Google. It reads code and reports suspected vulnerabilities. It is not part of AMX and is not an officially supported Google product, so **treat every finding as a lead to verify by hand, not a confirmed bug.**

Requirements: Linux or WSL2 (not native Windows), Python 3.12+, a Google Cloud project with Vertex AI enabled. Model calls are billed to that project, so set a budget alert first.

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
