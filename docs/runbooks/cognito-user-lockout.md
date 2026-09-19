# Runbook: Cognito User Lockout Resolution

**Trigger:** a user reports they can't log in, or the login audit log
(`GET /api/audit-log`, Module 7.5 in this repo's local auth stand-in — Cognito in production)
shows repeated failed attempts for one account.

## What this means

Production auth is AWS Cognito (`Ams-Auth/AmsUserPool`); this repo's local dev auth
(`apps/api/src/modules/auth`) mirrors its behaviour (JWT, MFA, per-dealer scoping) without a real
Cognito dependency, so the diagnostic steps below apply to whichever is actually in front of you.

Common lockout causes: too many failed password attempts (Cognito's default account-lockout
policy), an expired temporary password, MFA device lost/reset, or the account was deliberately
deactivated by the dealer principal (`user.active = false` — see §7.3).

## Diagnose

**Cognito (production):**
```bash
aws cognito-idp admin-get-user --user-pool-id <pool-id> --username <email>
```
Check `UserStatus` (`FORCE_CHANGE_PASSWORD`, `RESET_REQUIRED`, `CONFIRMED`) and whether MFA is
configured but the user's device is gone.

**This repo's local auth:**
```sql
select * from login_audits where email = '<email>' order by "createdAt" desc limit 20;
select active, "mfaEnabled" from users where email = '<email>';
```

## Resolve

- **Too many failed attempts (temporary lockout):** wait out Cognito's lockout window, or as an
  admin: `aws cognito-idp admin-reset-user-password --user-pool-id <pool-id> --username <email>`.
- **Lost MFA device:** `aws cognito-idp admin-set-user-mfa-preference` to disable MFA temporarily,
  have the user re-enrol a new device, then re-enable enforcement if the role requires it
  (dealer_principal / general_manager mandate MFA per §7.4).
- **Deliberately deactivated account:** confirm with the dealer principal before reactivating —
  check `audit_logs` for the `user.update` entry that deactivated them and why. Reactivate via
  `PATCH /api/users/:id` with `{ "active": true }` (local) or `admin-enable-user` (Cognito).
- **Forgotten password, account otherwise healthy:** direct the user through the standard
  forgot-password flow rather than manually resetting — keeps the audit trail clean.

## Verify recovery

A fresh login attempt succeeds and appears in the login audit log as `success: true`.
