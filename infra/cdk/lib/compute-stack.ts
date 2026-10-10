import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface ComputeStackProps extends StackProps {
  vpc: ec2.Vpc;
  databaseSecret: secretsmanager.ISecret;
  filesBucket: s3.Bucket;
  vehicleUpdateQueue: sqs.Queue;
  /** From Ams-Data: rediss:// URL for the Socket.IO adapter. */
  redisUrl: string;
  /** From Ams-Storage: CloudFront base URL for stored files. */
  filesBaseUrl: string;
}

/**
 * ECS Fargate: the main NestJS API (behind an ALB) plus the always-on MQTT Subscriber
 * microservice described in the BMW RIS integration section of the spec. Both run in the same
 * cluster; the MQTT subscriber has no public ingress — it only holds an outbound connection to
 * BMW's broker and publishes to SQS.
 */
export class ComputeStack extends Stack {
  /** Exposed so the Edge (CloudFront/WAF) and Observability stacks can front and monitor the API. */
  readonly apiService: ecs_patterns.ApplicationLoadBalancedFargateService;
  /** One-off `prisma migrate deploy` task definition; the deploy workflow runs it before each rollout. */
  readonly migrateTaskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'AmsCluster', { vpc: props.vpc, containerInsightsV2: ecs.ContainerInsights.ENABLED });

    // The repo is created idempotently by the deploy workflow BEFORE the first image push (so the very
    // first deploy has an image to pull); CDK only references it.
    const apiRepo = ecr.Repository.fromRepositoryName(this, 'ApiRepo', 'ams-api');
    // --- Configuration ------------------------------------------------------
    // Deployment-specific values come from CDK context (-c key=value) so nothing environment-specific
    // is hard-coded. The API refuses to start if any required production setting is missing
    // (apps/api/src/common/config/production-config.ts), so a gap here fails the rollout loudly.
    const ctx = (key: string): string => {
      const value = this.node.tryGetContext(key) as string | undefined;
      if (!value) {
        throw new Error(`Missing CDK context "${key}" — pass it with: cdk deploy -c ${key}=<value>`);
      }
      return value;
    };
    const domainName = ctx('domainName');

    // Generated once by Secrets Manager, never in source control or the task definition. Rotate by
    // updating the secret and redeploying (rotating JWT secrets signs every user out; rotating
    // VHC_LINK_SECRET invalidates emailed health-check links).
    const generated = (name: string) =>
      new secretsmanager.Secret(this, name, { generateSecretString: { passwordLength: 64, excludePunctuation: true } });
    const jwtAccess = generated('JwtAccessSecret');
    const jwtRefresh = generated('JwtRefreshSecret');
    const captchaSecret = generated('CaptchaSecret');
    const vhcLinkSecret = generated('VhcLinkSecret');
    const awpWebhookSecret = generated('AwpWebhookSecret');

    // Third-party credentials cannot be generated: after the first deploy, paste the real values into
    // these secrets in the console (Cloudflare Turnstile secret + site key, DVLA API key).
    const manual = (name: string, description: string) => new secretsmanager.Secret(this, name, { description });
    const turnstileSecret = manual('TurnstileSecret', 'Cloudflare Turnstile secret key — set after first deploy');
    const turnstileSiteKey = manual('TurnstileSiteKey', 'Cloudflare Turnstile site key — set after first deploy');
    const dvlaApiKey = manual('DvlaApiKey', 'DVLA Vehicle Enquiry Service API key — set after first deploy');

    const dbSecrets = {
      DB_HOST: ecs.Secret.fromSecretsManager(props.databaseSecret, 'host'),
      DB_PORT: ecs.Secret.fromSecretsManager(props.databaseSecret, 'port'),
      DB_NAME: ecs.Secret.fromSecretsManager(props.databaseSecret, 'dbname'),
      DB_USER: ecs.Secret.fromSecretsManager(props.databaseSecret, 'username'),
      DB_PASSWORD: ecs.Secret.fromSecretsManager(props.databaseSecret, 'password'),
    };

    // Main API — GET /api/health backs the ALB and ECS health checks.
    const apiService = (this.apiService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
      cluster,
      cpu: 1024,
      memoryLimitMiB: 2048, // headless Chromium for PDF rendering needs the headroom
      desiredCount: 2,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(apiRepo, 'latest'),
        containerPort: 3000,
        environment: {
          NODE_ENV: 'production',
          API_PORT: '3000',
          AWS_REGION: this.region,
          // CloudFront -> ALB -> task: two proxy hops before the viewer's real IP (rate limiting keys on it).
          TRUST_PROXY: '2',
          CORS_ORIGIN: `https://${domainName}`,
          PUBLIC_WEB_URL: `https://${domainName}`,
          REDIS_URL: props.redisUrl,
          STORAGE_DRIVER: 's3',
          STORAGE_S3_BUCKET: props.filesBucket.bucketName,
          STORAGE_PUBLIC_BASE_URL: props.filesBaseUrl,
          EMAIL_DRIVER: 'ses',
          EMAIL_FROM: ctx('emailFrom'),
          SMS_DRIVER: 'console', // switch to twilio once credentials exist (see docs/DEPLOYMENT.md)
          AI_DRIVER: 'bedrock',
          BEDROCK_MODEL_REASONING: ctx('bedrockReasoningModel'),
          BEDROCK_MODEL_LIGHTWEIGHT: ctx('bedrockLightweightModel'),
          CAPTCHA_DRIVER: 'turnstile',
          DVLA_DRIVER: 'live',
          PDF_DRIVER: 'puppeteer',
          JWT_ACCESS_EXPIRY: '15m',
          JWT_REFRESH_EXPIRY: '7d',
          AUTH_MAX_FAILED_LOGINS: '5',
          AUTH_LOCKOUT_MINUTES: '15',
        },
        secrets: {
          ...dbSecrets,
          JWT_ACCESS_SECRET: ecs.Secret.fromSecretsManager(jwtAccess),
          JWT_REFRESH_SECRET: ecs.Secret.fromSecretsManager(jwtRefresh),
          CAPTCHA_SECRET: ecs.Secret.fromSecretsManager(captchaSecret),
          VHC_LINK_SECRET: ecs.Secret.fromSecretsManager(vhcLinkSecret),
          AWP_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(awpWebhookSecret),
          TURNSTILE_SECRET: ecs.Secret.fromSecretsManager(turnstileSecret),
          TURNSTILE_SITE_KEY: ecs.Secret.fromSecretsManager(turnstileSiteKey),
          DVLA_API_KEY: ecs.Secret.fromSecretsManager(dvlaApiKey),
        },
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup: new logs.LogGroup(this, 'ApiLogGroup', { logGroupName: '/ams/api', retention: logs.RetentionDays.THREE_MONTHS }) }),
      },
      publicLoadBalancer: true,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
    }));
    apiService.targetGroup.configureHealthCheck({ path: '/api/health/ready', interval: Duration.seconds(30), healthyHttpCodes: '200' });
    apiService.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '30');

    const taskRole = apiService.taskDefinition.taskRole;
    props.filesBucket.grantReadWrite(taskRole);
    taskRole.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ['ses:SendEmail', 'ses:SendRawEmail'], resources: ['*'] }));
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({ actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'], resources: ['*'] }),
    );

    // Scale on load, not just on crashes; never below 2 so a single task loss is invisible.
    const scaling = apiService.service.autoScaleTaskCount({ minCapacity: 2, maxCapacity: 6 });
    scaling.scaleOnCpuUtilization('CpuScaling', { targetUtilizationPercent: 60, scaleInCooldown: Duration.minutes(5) });

    // One-off migration task: same repo, `migrate` image tag (built by the deploy workflow). Run via
    // `aws ecs run-task` BEFORE the new API version rolls out, so replicas never race to migrate.
    this.migrateTaskDefinition = new ecs.FargateTaskDefinition(this, 'MigrateTaskDef', { family: 'ams-migrate', cpu: 512, memoryLimitMiB: 1024 });
    this.migrateTaskDefinition.addContainer('MigrateContainer', {
      image: ecs.ContainerImage.fromEcrRepository(apiRepo, 'migrate'),
      secrets: dbSecrets,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'migrate', logGroup: new logs.LogGroup(this, 'MigrateLogGroup', { logGroupName: '/ams/migrate', retention: logs.RetentionDays.ONE_MONTH }) }),
    });
    const migrateSecurityGroup = new ec2.SecurityGroup(this, 'MigrateSecurityGroup', { vpc: props.vpc, description: 'Migration task: outbound only' });
    new CfnOutput(this, 'MigrateSecurityGroupId', { value: migrateSecurityGroup.securityGroupId });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'MigrateTaskDefinitionArn', { value: this.migrateTaskDefinition.taskDefinitionArn });
    new CfnOutput(this, 'PrivateSubnetIds', { value: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds.join(',') });

    // MQTT Subscriber — OPT-IN. The subscriber image does not exist yet and BMW RIS broker access
    // needs BMW approval, so a default deploy skips it (an unstartable service would fail the whole
    // rollout). Enable with `-c enableMqttSubscriber=true` once the image is built and credentials exist.
    if (this.node.tryGetContext('enableMqttSubscriber') === 'true') {
      const mqttRepo = new ecr.Repository(this, 'MqttSubscriberRepo', { repositoryName: 'ams-mqtt-subscriber' });

      const mqttSecret = new secretsmanager.Secret(this, 'BmwRisMqttCredentials', {
        description: 'BMW RIS MQTT broker host, client ID, TLS cert/key — access requires BMW colleague approval',
      });

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
}
