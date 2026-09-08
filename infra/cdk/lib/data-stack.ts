import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface DataStackProps extends StackProps {
  vpc: ec2.Vpc;
}

/**
 * Aurora PostgreSQL Serverless v2 (the operational database — see apps/api/prisma/schema.prisma
 * for everything it stores) and ElastiCache Redis (pub/sub for the live workshop board, and a
 * general cache). Both live in the isolated data subnets with no direct internet route.
 */
export class DataStack extends Stack {
  readonly databaseSecret: secretsmanager.ISecret;
  readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
      vpc: props.vpc,
      description: 'Allows ECS tasks (anywhere in the VPC) to reach Aurora on 5432',
      allowAllOutbound: false,
    });
    // Scoped to the VPC CIDR rather than a cross-stack security-group reference, which would
    // create a dependency cycle with ComputeStack (its ALB service depends on this stack's secret).
    this.dbSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(5432));

    const cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_16_4 }),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      readers: [rds.ClusterInstance.serverlessV2('reader', { scaleWithWriter: true })],
      defaultDatabaseName: 'ams',
      storageEncrypted: true,
      backup: { retention: Duration.days(7) },
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    this.databaseSecret = cluster.secret!;

    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Private subnets for ElastiCache Redis',
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
    });

    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', { vpc: props.vpc });

    new elasticache.CfnReplicationGroup(this, 'RedisReplicationGroup', {
      replicationGroupDescription: 'AMS workshop board pub/sub + general cache',
      engine: 'redis',
      cacheNodeType: 'cache.t4g.micro',
      numCacheClusters: 2,
      automaticFailoverEnabled: true,
      cacheSubnetGroupName: cacheSubnetGroup.ref,
      securityGroupIds: [redisSecurityGroup.securityGroupId],
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
    });
  }
}
