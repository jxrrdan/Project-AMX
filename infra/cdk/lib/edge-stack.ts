import { CfnOutput, RemovalPolicy, Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';

export interface EdgeStackProps extends StackProps {
  apiService: ecs_patterns.ApplicationLoadBalancedFargateService;
}

/**
 * The edge/CDN + WAF layer the scaffold's README left as follow-up:
 *  - an S3 bucket that holds the built Angular SPA (private, served only through CloudFront),
 *  - a CloudFront distribution serving the SPA and proxying /api/* to the ALB,
 *  - an AWS-managed WAF WebACL attached to the ALB (where all traffic terminates).
 *
 * DNS lives in Cloudflare (not Route 53), so a custom domain is wired via a bring-your-own ACM
 * certificate: create/validate a cert in us-east-1 (CloudFront's required region) using a DNS
 * record you add in Cloudflare, then pass it in:
 *
 *   cdk deploy Ams-Edge -c domainName=ams.example.com -c certificateArn=arn:aws:acm:us-east-1:...:certificate/...
 *
 * You then add a CNAME in Cloudflare from that hostname to the distribution's domain (output
 * `DistributionDomainName`). Without the context values the stack synthesizes and deploys cleanly
 * on the default CloudFront domain.
 */
export class EdgeStack extends Stack {
  readonly webBucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: EdgeStackProps) {
    super(scope, id, props);

    // Optional custom domain via a bring-your-own (Cloudflare-validated) ACM cert in us-east-1.
    const domainName = this.node.tryGetContext('domainName') as string | undefined;
    const certificateArn = this.node.tryGetContext('certificateArn') as string | undefined;
    const customDomain =
      domainName && certificateArn
        ? { domainNames: [domainName], certificate: acm.Certificate.fromCertificateArn(this, 'Cert', certificateArn) }
        : {};

    // --- SPA hosting bucket (private; reached only via CloudFront OAC) ------
    this.webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: undefined,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // --- Regional WAF on the ALB ------------------------------------------
    // The ALB is where requests actually terminate (CloudFront forwards /api to it), so the WebACL
    // lives here as a REGIONAL ACL rather than a CloudFront-scoped one (which must be in us-east-1).
    const webAcl = new wafv2.CfnWebACL(this, 'ApiWebAcl', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'ams-api-waf', sampledRequestsEnabled: true },
      rules: [
        {
          name: 'AWSCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' } },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'aws-common', sampledRequestsEnabled: true },
        },
        {
          name: 'AWSKnownBadInputs',
          priority: 2,
          overrideAction: { none: {} },
          statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesKnownBadInputsRuleSet' } },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'aws-known-bad', sampledRequestsEnabled: true },
        },
        {
          name: 'RateLimitPerIp',
          priority: 3,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: 2000, aggregateKeyType: 'IP' } },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'rate-limit', sampledRequestsEnabled: true },
        },
      ],
    });
    new wafv2.CfnWebACLAssociation(this, 'ApiWebAclAssociation', {
      resourceArn: props.apiService.loadBalancer.loadBalancerArn,
      webAclArn: webAcl.attrArn,
    });

    // --- CloudFront: SPA by default, /api/* to the ALB ---------------------
    const albOrigin = new origins.LoadBalancerV2Origin(props.apiService.loadBalancer, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'AMS — SPA + API',
      defaultRootObject: 'index.html',
      ...customDomain,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        'api/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      // SPA client-side routing: serve index.html for unmatched paths.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.minutes(5) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.minutes(5) },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // The CNAME target to create in Cloudflare (point ams.<domain> at this, DNS-only / grey-cloud).
    new CfnOutput(this, 'DistributionDomainName', { value: this.distribution.distributionDomainName });
    new CfnOutput(this, 'WebBucketName', { value: this.webBucket.bucketName });
    if (domainName) {
      new CfnOutput(this, 'ConfiguredCustomDomain', { value: domainName });
    }
  }
}
