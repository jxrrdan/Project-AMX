# Runbook: ECS Task Scaling Manual Override

**Alarms that lead here:** `ECS CPU` (P3, Slack, >70% sustained), `API P99 latency` (P2, >3s),
or a scheduled traffic spike a dealer has warned about in advance (e.g. a stock clearance event).

## What this means

`Ams-Compute/ApiService` runs on ECS Fargate with `desiredCount: 2` and no auto-scaling policy
defined in this scaffold (see `infra/cdk/lib/compute-stack.ts`) — capacity changes are manual
until an Application Auto Scaling target is added. This runbook is the stopgap for that gap.

## Scale out (increase capacity)

```bash
aws ecs update-service \
  --cluster AmsCluster \
  --service ApiService \
  --desired-count <N>
```

Pick `<N>` conservatively — each task is 512 CPU / 1024 MiB per the stack definition; watch
Aurora's connection count after scaling, since more API tasks means more Prisma connection pool
slots against the same database.

## Scale back in

Reverse the same command once the CPU/latency alarms clear and stay clear for a sustained period
(don't scale down the moment the alarm resolves — traffic spikes often have a second wave).

## Longer-term fix

This manual step is exactly what an Application Auto Scaling target + step/target-tracking policy
on `ApiService`'s CPU or ALB request count would remove. That's a natural next addition to
`ComputeStack` once real traffic patterns are known — see `infra/cdk/README.md` for the list of
what's deliberately not wired up yet.

## Verify recovery

API P99 latency drops back under the 3-second alarm threshold, and CPU utilisation per task
settles below 70%.
