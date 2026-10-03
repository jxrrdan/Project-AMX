import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface ObservabilityStackProps extends StackProps {
  apiService: ecs_patterns.ApplicationLoadBalancedFargateService;
  cluster: rds.DatabaseCluster;
  vehicleUpdateQueue: sqs.Queue;
}

/**
 * The observability pass the scaffold's README left as follow-up: a single operational dashboard
 * plus the P1/P2 alarms from the spec's alerting table (beyond the DLQ-depth alarm, which lives
 * with the queue it watches). Everything routes to one SNS topic an on-call rotation subscribes to.
 */
export class ObservabilityStack extends Stack {
  readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    this.alarmTopic = new sns.Topic(this, 'AmsOpsAlarms', { topicName: 'ams-ops-alarms' });
    const notify = (alarm: cloudwatch.Alarm) => alarm.addAlarmAction(new cw_actions.SnsAction(this.alarmTopic));

    const lb = props.apiService.loadBalancer;
    const service = props.apiService.service;
    const targetGroup = props.apiService.targetGroup;

    // --- Metrics -----------------------------------------------------------
    const alb5xx = lb.metrics.httpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT, { period: Duration.minutes(1) });
    const target5xx = lb.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, { period: Duration.minutes(1) });
    const latencyP95 = lb.metrics.targetResponseTime({ period: Duration.minutes(5), statistic: 'p95' });
    const requestCount = lb.metrics.requestCount({ period: Duration.minutes(5) });
    const healthyHosts = targetGroup.metrics.healthyHostCount({ period: Duration.minutes(1) });
    const apiCpu = service.metricCpuUtilization({ period: Duration.minutes(5) });
    const apiMem = service.metricMemoryUtilization({ period: Duration.minutes(5) });
    const dbCpu = props.cluster.metricCPUUtilization({ period: Duration.minutes(5) });
    const dbConns = props.cluster.metricDatabaseConnections({ period: Duration.minutes(5) });
    const queueBacklog = props.vehicleUpdateQueue.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(1) });
    const queueAge = props.vehicleUpdateQueue.metricApproximateAgeOfOldestMessage({ period: Duration.minutes(1) });

    // --- Alarms (spec Observability & Alerting table) ----------------------
    notify(
      new cloudwatch.Alarm(this, 'Api5xxAlarm', {
        metric: target5xx,
        threshold: 10,
        evaluationPeriods: 5,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'API is returning sustained 5xx errors',
      }),
    );
    notify(
      new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
        metric: latencyP95,
        threshold: 2, // seconds
        evaluationPeriods: 5,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'API p95 latency above 2s for 25 minutes',
      }),
    );
    notify(
      new cloudwatch.Alarm(this, 'ApiNoHealthyHostsAlarm', {
        metric: healthyHosts,
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
        alarmDescription: 'No healthy API tasks behind the load balancer (P1)',
      }),
    );
    notify(
      new cloudwatch.Alarm(this, 'DbCpuAlarm', {
        metric: dbCpu,
        threshold: 80,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: 'Aurora CPU sustained above 80%',
      }),
    );
    notify(
      new cloudwatch.Alarm(this, 'QueueBacklogAlarm', {
        metric: queueAge,
        threshold: Duration.minutes(15).toSeconds(),
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'Oldest vehicle-update message is older than 15 minutes — ingest is falling behind',
      }),
    );

    // --- Dashboard ---------------------------------------------------------
    const dashboard = new cloudwatch.Dashboard(this, 'AmsOpsDashboard', { dashboardName: 'ams-operations' });
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({ title: 'API requests & errors', left: [requestCount], right: [alb5xx, target5xx], width: 12 }),
      new cloudwatch.GraphWidget({ title: 'API latency (p95, s)', left: [latencyP95], width: 12 }),
    );
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({ title: 'API task CPU / memory %', left: [apiCpu, apiMem], width: 12 }),
      new cloudwatch.SingleValueWidget({ title: 'Healthy API hosts', metrics: [healthyHosts], width: 12 }),
    );
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({ title: 'Aurora CPU % / connections', left: [dbCpu], right: [dbConns], width: 12 }),
      new cloudwatch.GraphWidget({ title: 'Vehicle-update queue', left: [queueBacklog], right: [queueAge], width: 12 }),
    );
  }
}
