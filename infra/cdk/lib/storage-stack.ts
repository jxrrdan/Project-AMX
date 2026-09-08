import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

/**
 * S3 bucket for all dealer files (vehicle photos, PDI checklist PDFs, generated invoices,
 * documents — see StorageService for the local-dev equivalent). Paths are prefixed
 * `dealer-{id}/...` at the application layer; this bucket does not itself enforce that
 * boundary, so the API's tenant checks are the real isolation control.
 */
export class StorageStack extends Stack {
  readonly filesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.filesBucket = new s3.Bucket(this, 'AmsFilesBucket', {
      bucketName: undefined, // let CDK generate a globally-unique name
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'transition-old-versions',
          noncurrentVersionTransitions: [{ storageClass: s3.StorageClass.GLACIER, transitionAfter: Duration.days(90) }],
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['https://*.ams-app.co.uk'],
          allowedHeaders: ['*'],
        },
      ],
    });
  }
}
