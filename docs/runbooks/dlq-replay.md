# Runbook: DLQ Replay

**Alarm:** `SQS DLQ messages` (P1, pages) — `Ams-Queue/VehicleUpdateDlq` depth > 0.

## What this means

A message from the BMW RIS ingest pipeline (MQTT Subscriber → `VehicleUpdateQueue` → Vehicle
Update Lambda → Aurora) failed processing 5 times (`maxReceiveCount: 5`, see
`infra/cdk/lib/queue-stack.ts`) and landed in the dead-letter queue instead of being applied.
Every message here represents a vehicle record that is stale or missing an update.

## Diagnose

1. Peek at a DLQ message without deleting it:
   ```bash
   aws sqs receive-message --queue-url <VehicleUpdateDlq-url> --max-number-of-messages 1
   ```
2. Cross-reference the VIN + event type in the message body against `/ams/api` logs and the
   `vehicles` table — common causes: a VIN that doesn't match any dealer's expected pattern (bad
   data from BMW), a malformed payload from a BMW API schema change, or a transient Aurora
   connection failure during a deploy/failover window (see `aurora-failover.md`).
3. Check whether the failure is isolated to one message or a whole batch from the same time
   window — a batch failure usually means the consumer (Vehicle Update Lambda) itself was broken
   by a bad deploy, not bad data.

## Resolve

- **Transient failure (Aurora was mid-failover, Lambda cold-start timeout, etc.):** safe to
  replay as-is. Use the SQS console's "Start DLQ redrive" action, or:
  ```bash
  aws sqs start-message-move-task \
    --source-arn <VehicleUpdateDlq-arn> \
    --destination-arn <VehicleUpdateQueue-arn>
  ```
- **Bad payload (schema mismatch, garbage VIN):** do not blindly replay — it will fail 5 more
  times and land right back here. Fix the transform in the MQTT Subscriber service (or the
  Lambda's validation) first, then replay only that message.
- **Consumer bug:** roll back the Lambda/subscriber to the last known-good version before
  replaying anything.

## Verify recovery

DLQ depth returns to 0, and the replayed vehicle records show the expected status in the
pipeline board (Module 1) without duplicate entries — the Vehicle Update Lambda's dedup key
(VIN + event type + timestamp) should prevent double-application on replay.
