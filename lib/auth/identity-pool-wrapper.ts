import {
  UserPool,
  UserPoolClient,
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { CfnOutput } from 'aws-cdk-lib';
import { Effect, FederatedPrincipal, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';

export class IdentityPoolWrapper {
  private scope: Construct;
  private userPool: UserPool;
  private userpoolClient: UserPoolClient;

  private identityPool: CfnIdentityPool;
  private authenticatedRole: Role;
  private unAuthenticatedRole: Role;
  public adminRole!: Role;

  constructor(scope: Construct, userPool: UserPool, userpoolClient: UserPoolClient) {
    this.scope = scope;
    this.userPool = userPool;
    this.userpoolClient = userpoolClient;
    this.initialize();
  }

  private initialize() {
    this.initializeIdentityPool();
    this.initializeAuthenticatedRole();
    this.initializeUnAuthenticatedRole();
    this.initializeAdminRole();
    this.attachRoles();
  }

  private initializeIdentityPool() {
    this.identityPool = new CfnIdentityPool(this.scope, 'HashibisIdentityPool', {
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        {
          clientId: this.userpoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    new CfnOutput(this.scope, 'IdentityPoolId', {
      value: this.identityPool.ref,
    });
  }

  private initializeAuthenticatedRole() {
    this.authenticatedRole = new Role(this.scope, 'CognitoDefaultAuthenticatedRole', {
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    this.authenticatedRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['mobileanalytics:PutEvents', 'cognito-sync:*', 'cognito-identity:*'],
        resources: ['*'],
      })
    );

    this.authenticatedRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: ['*'],
      })
    );
  }

  private initializeUnAuthenticatedRole() {
    this.unAuthenticatedRole = new Role(this.scope, 'CognitoDefaultUnAuthenticatedRole', {
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    this.unAuthenticatedRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: ['*'],
      })
    );
  }

  private initializeAdminRole() {
    this.adminRole = new Role(this.scope, 'CognitoDefaultAdminRole', {
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'admin',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    this.adminRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:DeleteObject'],
        resources: ['*'],
      })
    );
  }

  private attachRoles() {
    new CfnIdentityPoolRoleAttachment(this.scope, 'HashibisIdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        auhtneitcated: this.authenticatedRole.roleArn,
        unauthenticated: this.unAuthenticatedRole.roleArn,
      },
      roleMappings: {
        adminMapping: {
          type: 'Token',
          ambiguousRoleResolution: 'AuthenticatedRole',
          identityProvider: `${this.userPool.userPoolProviderName}:${this.userpoolClient.userPoolClientId}`,
        },
      },
    });
  }
}
