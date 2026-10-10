#!/usr/bin/env bash
# Runs the one-off `prisma migrate deploy` ECS task and fails the pipeline if it fails.
#   run-migration.sh optional   skip quietly if the migration task definition does not exist yet (first deploy)
#   run-migration.sh required   fail if it cannot run
set -euo pipefail
MODE="${1:-required}"

if ! aws ecs describe-task-definition --task-definition ams-migrate >/dev/null 2>&1; then
  if [ "$MODE" = "optional" ]; then
    echo "No ams-migrate task definition yet (first deploy) — skipping pre-rollout migration."
    exit 0
  fi
  echo "ams-migrate task definition not found" >&2
  exit 1
fi

out() { aws cloudformation describe-stacks --stack-name Ams-Compute --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
CLUSTER="$(out ClusterName)"
SUBNETS="$(out PrivateSubnetIds)"
SG="$(out MigrateSecurityGroupId)"

TASK_ARN="$(aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE --task-definition ams-migrate \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)"
echo "Started migration task $TASK_ARN"
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN"

EXIT_CODE="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" --query 'tasks[0].containers[0].exitCode' --output text)"
if [ "$EXIT_CODE" != "0" ]; then
  echo "Migration failed (exit code $EXIT_CODE) — see CloudWatch log group /ams/migrate" >&2
  exit 1
fi
echo "Migration complete."
