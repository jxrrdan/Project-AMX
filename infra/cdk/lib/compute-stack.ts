import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface ComputeStackProps extends StackProps {
  vpc: ec2.Vpc;
  databaseSecret: secretsmanager.ISecret;
  filesBucket: s3.Bucket;
  vehicleUpdateQueue: sqs.Queue;
}

/**
 * ECS Fargate: the main NestJS API (behind an ALB) plus the always-on MQTT Subscriber
 * microservice described in the BMW RIS integration section of the spec. Both run in the same
 * cluster; the MQTT subscriber has no public ingress — it only holds an outbound connection to
 * BMW's broker and publishes to SQS.
 */
export class ComputeStack extends Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'AmsCluster', { vpc: props.vpc, containerInsightsV2: ecs.ContainerInsights.ENABLED });

    const apiRepo = new ecr.Repository(this, 'ApiRepo', { repositoryName: 'ams-api' });
    const mqttRepo = new ecr.Repository(this, 'MqttSubscriberRepo', { repositoryName: 'ams-mqtt-subscriber' });

    const mqttSecret = new secretsmanager.Secret(this, 'BmwRisMqttCredentials', {
      description: 'BMW RIS MQTT broker host, client ID, TLS cert/key — access requires BMW colleague approval',
    });

    // Main API — GET /health backs both the ECS health check and the Route 53 health check.
    const apiService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
      cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 2,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(apiRepo, 'latest'),
        containerPort: 3000,
        environment: { NODE_ENV: 'production' },
        secrets: { DATABASE_URL: ecs.Secret.fromSecretsManager(props.databaseSecret) },
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup: new logs.LogGroup(this, 'ApiLogGroup', { logGroupName: '/ams/api', retention: logs.RetentionDays.THREE_MONTHS }) }),
      },
      publicLoadBalancer: true,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
    });
    apiService.targetGroup.configureHealthCheck({ path: '/api/health', interval: Duration.seconds(30) });
    props.databaseSecret.grantRead(apiService.taskDefinition.taskRole);
    props.filesBucket.grantReadWrite(apiService.taskDefinition.taskRole);

    // MQTT Subscriber — always-on, no load balancer; ECS restarts it on crash per the spec.
    const mqttTaskDefinition = new ecs.FargateTaskDefinition(this, 'MqttSubscriberTaskDef', { cpu: 256, memoryLimitMiB: 512 });
    mqttTaskDefinition.addContainer('MqttSubscriberContainer', {
      image: ecs.ContainerImage.fromEcrRepository(mqttRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'mqtt-subscriber', logGroup: new logs.LogGroup(this, 'MqttLogGroup', { logGroupName: '/ams/mqtt-subscriber', retention: logs.RetentionDays.THREE_MONTHS }) }),
      secrets: { MQTT_CREDENTIALS: ecs.Secret.fromSecretsManager(mqttSecret) },
      environment: { SQS_QUEUE_URL: props.vehicleUpdateQueue.queueUrl },
    });
    props.vehicleUpdateQueue.grantSendMessages(mqttTaskDefinition.taskRole);
    mqttSecret.grantRead(mqttTaskDefinition.taskRole);

    new ecs.FargateService(this, 'MqttSubscriberService', {
      cluster,
      taskDefinition: mqttTaskDefinition,
      desiredCount: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      minHealthyPercent: 0,
    });
  }
}
