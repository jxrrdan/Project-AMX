import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';

/**
 * AWS Cognito user pool for subdomain-per-dealer tenancy (Feature Spec: "Auth: AWS Cognito
 * (JWT, MFA, subdomain-per-dealer tenancy)"). The `dealerId` custom attribute is set on each
 * user at creation and read from the JWT claim by API Gateway's Cognito authorizer — the local
 * dev stand-in for this (apps/api/src/modules/auth) issues the same shaped claim itself.
 */
export class AuthStack extends Stack {
  readonly userPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'AmsUserPool', {
      userPoolName: 'ams-users',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: true, otp: true },
      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      customAttributes: {
        dealerId: new cognito.StringAttribute({ mutable: false }),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.userPool.addClient('AmsWebClient', {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      accessTokenValidity: undefined,
    });
  }
}
