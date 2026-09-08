import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';

/**
 * The BMW RIS ingest path: MQTT Subscriber Service (ECS, see ComputeStack) → this queue →
 * Vehicle Update Lambda (apps/workers, not modelled here) → Aurora + EventBridge. A non-empty
 * DLQ is a P1 page per the spec's alerting table (DLQ depth > 0).
 */
export class QueueStack extends Stack {
  readonly vehicleUpdateQueue: sqs.Queue;
  readonly vehicleUpdateDlq: sqs.Queue;
  readonly eventBus: events.EventBus;
  readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.alertTopic = new sns.Topic(this, 'AmsAlertsTopic', { topicName: 'ams-alerts' });

    this.vehicleUpdateDlq = new sqs.Queue(this, 'VehicleUpdateDlq', {
      queueName: 'ams-vehicle-update-dlq',
      retentionPeriod: Duration.days(14),
    });

    this.vehicleUpdateQueue = new sqs.Queue(this, 'VehicleUpdateQueue', {
      queueName: 'ams-vehicle-update-queue',
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: this.vehicleUpdateDlq, maxReceiveCount: 5 },
    });

    this.eventBus = new events.EventBus(this, 'AmsEventBus', { eventBusName: 'ams-events' });

    // P1 page: DLQ depth > 0 (Feature Spec — Observability & Alerting).
    const dlqDepthAlarm = new cloudwatch.Alarm(this, 'DlqDepthAlarm', {
      metric: this.vehicleUpdateDlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      alarmDescription: 'Vehicle Update DLQ has messages — BMW RIS events are failing to process',
    });
    dlqDepthAlarm.addAlarmAction(new cw_actions.SnsAction(this.alertTopic));
  }
}
