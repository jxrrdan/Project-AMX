#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DataStack } from '../lib/data-stack';
import { AuthStack } from '../lib/auth-stack';
import { StorageStack } from '../lib/storage-stack';
import { QueueStack } from '../lib/queue-stack';
import { ComputeStack } from '../lib/compute-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-2',
};

const network = new NetworkStack(app, 'Ams-Network', { env });
const data = new DataStack(app, 'Ams-Data', { env, vpc: network.vpc });
new AuthStack(app, 'Ams-Auth', { env });
const storage = new StorageStack(app, 'Ams-Storage', { env });
const queue = new QueueStack(app, 'Ams-Queue', { env });
new ComputeStack(app, 'Ams-Compute', {
  env,
  vpc: network.vpc,
  databaseSecret: data.databaseSecret,
  filesBucket: storage.filesBucket,
  vehicleUpdateQueue: queue.vehicleUpdateQueue,
});
