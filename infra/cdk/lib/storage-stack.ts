import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

/**
 * S3 bucket for all dealer files (vehicle photos, PDI checklist PDFs, generated invoices,
 * documents — see StorageService for the local-dev equivalent). Paths are prefixed
 * `dealer-{id}/...` at the application layer; this bucket does not itself enforce that
 * boundary, so the API's tenant checks are the real isolation control.
 */
export class StorageStack extends Stack {
  readonly filesBucket: s3.Bucket;
  /** CloudFront in front of the private bucket; the API returns URLs under this base (STORAGE_PUBLIC_BASE_URL). */
  readonly filesBaseUrl: string;

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

    // Objects stay private (BLOCK_ALL); the only read path is this distribution via origin access
    // control. Keys embed unguessable UUIDs, and the distribution is read-only (GET/HEAD).
    const filesDistribution = new cloudfront.Distribution(this, 'FilesDistribution', {
      comment: 'AMS dealer files (read-only)',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.filesBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });
    this.filesBaseUrl = `https://${filesDistribution.distributionDomainName}`;
    new CfnOutput(this, 'FilesBaseUrl', { value: this.filesBaseUrl });
  }
}
