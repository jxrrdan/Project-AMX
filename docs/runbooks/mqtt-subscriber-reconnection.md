# Runbook: MQTT Subscriber Reconnection

**Alarm:** `MQTT subscriber disconnected` (P1, pages) — no messages received for 10 minutes
during BMW business hours.

## What this means

The always-on MQTT Subscriber ECS service (`Ams-Compute/MqttSubscriberService`) has lost its
connection to the BMW RIS MQTT broker, or the broker itself has gone quiet. New vehicle orders,
allocation confirmations, and transit updates are not reaching Aurora — the pipeline board will
look frozen. SQS absorbs nothing during this window because the service never publishes anything.

## Diagnose

1. Check the service's task health in the ECS console (or `aws ecs describe-services --cluster
   AmsCluster --services MqttSubscriberService`) — is it running, or crash-looping?
2. Check `/ams/mqtt-subscriber` CloudWatch Logs for the most recent connection error (auth
   failure, TLS handshake failure, broker unreachable, credential rotation).
3. Check `ams.mqtt.messages_received` / `ams.mqtt.messages_failed` custom metrics — a flat zero
   confirms no traffic is arriving, not just an alarm glitch.
4. Confirm the BMW RIS broker's own status page / contact if one exists — this may be a BMW-side
   outage, not ours.

## Resolve

- **Task crashed / unhealthy:** ECS restarts it automatically per its health check; if it's
  crash-looping, the log will show why (usually expired MQTT credentials in Secrets Manager —
  see `BmwRisMqttCredentials` in `Ams-Compute`). Rotate the credential and force a new deployment:
  `aws ecs update-service --cluster AmsCluster --service MqttSubscriberService --force-new-deployment`.
- **Broker-side outage:** no action beyond monitoring; SQS queues nothing new but nothing is lost
  once the broker comes back, since the subscriber reconnects on startup and BMW's broker is
  expected to redeliver from where it left off (confirm this against BMW's actual MQTT QoS/retain
  behaviour once real credentials are available — this repo's version is a local mock, see
  `apps/api/src/modules/vehicles/ris-import.service.ts`).
- **Network/security group issue:** confirm the ECS task's security group still allows outbound
  443/8883 to BMW's broker host — a VPC change is the most common self-inflicted cause.

## Verify recovery

`ams.mqtt.messages_received` resumes incrementing, and the DLQ depth alarm stays quiet (a burst
of backlog on reconnect is expected and should drain within a few minutes).
