import { CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  ProviderAttribute,
  ResourceServerScope,
  UserPool,
  UserPoolClient,
  UserPoolIdentityProviderFacebook,
  UserPoolIdentityProviderGoogle,
  VerificationEmailStyle,
  CfnUserPoolUICustomizationAttachment,
} from 'aws-cdk-lib/aws-cognito';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { getResourceNameWithPrefix, getSecretArn, verificationEmail } from '../../util';
import { CfnAuthorizer, CfnApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { BasicStackProps } from '../../interfaces';
import { readFileSync } from 'fs';

export class CognitoAuthorizer {
  private scope: Construct;
  private api: CfnApi;
  private props: BasicStackProps;

  public userPool: UserPool;
  public userPoolClient: UserPoolClient;
  public authorizer: CfnAuthorizer;

  constructor(scope: Construct, api: CfnApi, props: BasicStackProps) {
    this.scope = scope;
    this.props = props;
    this.api = api;
    this.initialize();
  }

  private initialize() {
    this.createUserPool();
    this.addUserPoolClient();
    this.createUICustomizationAttachment();
    this.createAuthorizer();
  }

  private createUserPool() {
    this.userPool = new UserPool(this.scope, 'HashibisUserPool', {
      userPoolName: getResourceNameWithPrefix(`user-pool-${this.props.stage}`),
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: true,
      },
      userVerification: {
        emailSubject: verificationEmail.subject,
        emailBody: verificationEmail.body,
        emailStyle: VerificationEmailStyle.CODE,
      },
    });

    const userScope = new ResourceServerScope({
      scopeName: 'basic.access',
      scopeDescription: 'User resources access',
    });
    const adminScope = new ResourceServerScope({
      scopeName: 'admin.access',
      scopeDescription: 'Full access',
    });

    this.userPool.addResourceServer('resourceServerCognito', {
      userPoolResourceServerName: 'apigw-hashibis',
      identifier: 'apigw-hashibis-resource-server',
      scopes: [userScope, adminScope],
    });

    this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `hashibis-${this.props.stage}`,
      },
    });

    const secrets = Secret.fromSecretAttributes(this.scope, 'HashibisSecrets', {
      secretCompleteArn: getSecretArn({
        region: this.props.env?.region!,
        account: this.props.env?.account!,
        stage: this.props.stage,
      }),
    });

    const googleClientId = secrets.secretValueFromJson('GOOGLE_CLIENT_ID');
    const googleClientSecret = secrets.secretValueFromJson('GOOGLE_CLIENT_SECRET');

    new UserPoolIdentityProviderGoogle(this.scope, 'HashibisIdentityProviderGoogle', {
      clientId: googleClientId.unsafeUnwrap(),
      clientSecret: googleClientSecret.unsafeUnwrap(),
      userPool: this.userPool,
      attributeMapping: {
        birthdate: ProviderAttribute.GOOGLE_BIRTHDAYS,
        email: ProviderAttribute.GOOGLE_EMAIL,
        givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
        gender: ProviderAttribute.GOOGLE_GENDER,
        profilePicture: ProviderAttribute.GOOGLE_PICTURE,
        nickname: ProviderAttribute.GOOGLE_NAME,
      },
      scopes: ['profile', 'email', 'openid'],
    });

    const facebookAppId = secrets.secretValueFromJson('FACEBOOK_CLIENT_ID');
    const facebookAppSecret = secrets.secretValueFromJson('FACEBOOK_APP_SECRET');

    new UserPoolIdentityProviderFacebook(this.scope, 'HashibisIdentityProviderFacebook', {
      clientId: facebookAppId.unsafeUnwrap(),
      clientSecret: facebookAppSecret.unsafeUnwrap(),
      userPool: this.userPool,
      attributeMapping: {
        email: ProviderAttribute.FACEBOOK_EMAIL,
        fullname: ProviderAttribute.FACEBOOK_NAME,
        givenName: ProviderAttribute.FACEBOOK_FIRST_NAME,
        familyName: ProviderAttribute.FACEBOOK_LAST_NAME,
        birthdate: ProviderAttribute.FACEBOOK_BIRTHDAY,
        gender: ProviderAttribute.FACEBOOK_GENDER,
      },
    });

    new CfnOutput(this.scope, 'HashibisUserPoolId', {
      value: this.userPool.userPoolId,
    });
  }

  private addUserPoolClient() {
    this.userPoolClient = this.userPool.addClient('HashibisUserPoolClient', {
      userPoolClientName: getResourceNameWithPrefix(`user-pool-client-${this.props.stage}`),
      generateSecret: true,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        callbackUrls: [
          'http://localhost:3000/api/auth/callback/cognito_google',
          'http://localhost:3000/api/auth/callback/cognito_facebook',
        ],
      },
    });

    new CfnOutput(this.scope, 'HashibisUserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
  }

  private createUICustomizationAttachment() {
    new CfnUserPoolUICustomizationAttachment(this.scope, 'MyCfnUserPoolUICustomizationAttachment', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.userPoolClient.userPoolClientId,

      css: readFileSync('./assets/cognito-hosted-ui.css').toString('utf-8'),
    });
  }

  private createAuthorizer() {
    this.authorizer = new CfnAuthorizer(this.scope, 'HashibisApiAuthorizer', {
      name: getResourceNameWithPrefix(`authorizer-${this.props.stage}`),
      apiId: this.api.ref,
      authorizerType: 'JWT',
      identitySource: ['$request.header.Authorization'],
      jwtConfiguration: {
        audience: [this.userPoolClient.userPoolClientId],
        issuer: `https://cognito-idp.${this.props.env?.region}.amazonaws.com/${this.userPool.userPoolId}`,
      },
    });

    new CfnOutput(this.scope, 'HashibisAuthorizerId', {
      value: this.authorizer.ref,
      exportName: getResourceNameWithPrefix(`authorizer-id-${this.props.stage}`),
    });
  }
}
