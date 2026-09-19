# Runbook: Aurora Failover

**Alarms that precede this:** `Aurora CPU` (P2, >80% for 10 min), `Aurora freeable memory`
(P2, <1GB), or a hard connection failure reported by the API's `/health` check.

## What this means

`Ams-Data/AuroraCluster` is a writer + reader Serverless v2 cluster. A failover promotes the
reader to writer (RDS-managed, typically under a minute) — the trigger is usually writer
instance failure, an AZ outage, or a manual failover during patching.

## Diagnose

1. RDS console → the cluster's **Events** tab shows whether a failover already happened
   automatically (Aurora does this without waiting for a human in most cases).
2. Check RDS Performance Insights for the writer instance — sustained CPU/memory pressure before
   the event usually means a runaway query or a genuine capacity ceiling (Serverless v2 max is
   set to 4 ACUs in `Ams-Data` — raise `serverlessV2MaxCapacity` if this is a recurring pattern,
   not a one-off bad query).
3. Check API error logs (`/ams/api`) around the event time for `PrismaClientInitializationError`
   or connection-reset errors — confirms the app-tier impact window.

## Resolve

- **Automatic failover already completed:** confirm the API reconnected on its own — Prisma's
  connection pool retries transparently. If the API is still erroring after failover completes,
  restart the ECS service to force fresh connections:
  `aws ecs update-service --cluster AmsCluster --service ApiService --force-new-deployment`.
- **Failover hasn't happened but the writer is degraded:** trigger it manually — `aws rds
  failover-db-cluster --db-cluster-identifier <cluster-id>`.
- **Root cause is a runaway query:** identify it via Performance Insights' top-SQL view, kill it
  (`SELECT pg_terminate_backend(pid)`), and file it for review — a query with an obviously missing
  index is expected to be the most common cause here, especially any of the raw `$queryRaw` calls
  in the Parts module reorder-level report.

## Verify recovery

`GET /api/health` returns 200 with DB connectivity true, and Aurora CPU/freeable-memory metrics
return to baseline. Database recovery RTO target is <30 minutes (point-in-time restore); a plain
failover should be far faster than that.
