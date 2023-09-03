import { CfnOutput, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PermissionStackProps } from '../interfaces';
import { DynamoStack } from './dynamo-stack';
import {
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { getResourceNameWithPrefix, getSecretArn } from '../util';
import { BucketStack } from './bucket-stack';

export class PermissionStack extends Stack {
  props: PermissionStackProps;
  dynamoStack: DynamoStack;
  s3Stack: BucketStack;
  dynamoPolicy: PolicyStatement;
  s3Policy: PolicyStatement;
  lambdaPolicy: PolicyStatement;
  secretManagerPolicy: PolicyStatement;
  lambdaRole: Role;
  constructor(scope: Construct, id: string, props: PermissionStackProps) {
    super(scope, id, props);
    this.props = props;
    this.dynamoStack = props.stacks.dynamo;
    this.s3Stack = props.stacks.bucket;
    this.dynamoPolicy = this.createDynamoPolicy();
    this.s3Policy = this.createS3Policy();
    this.lambdaPolicy = this.createLambdaPolicy();
    this.secretManagerPolicy = this.createSecretManagerPolicy();
    this.lambdaRole = this.createLambdaRole();
    this.outputValues();
  }

  private createDynamoPolicy() {
    return new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:*'],
      resources: [
        this.dynamoStack.medicalHistoryTable.tableArn,
        `${this.dynamoStack.medicalHistoryTable.tableArn}/index/*`,
        this.dynamoStack.personalInformationTable.tableArn,
        `${this.dynamoStack.personalInformationTable.tableArn}/index/*`,
        this.dynamoStack.productTable.tableArn,
        `${this.dynamoStack.productTable.tableArn}/index/*`,
        this.dynamoStack.orderTable.tableArn,
        `${this.dynamoStack.orderTable.tableArn}/index/*`,
      ],
    });
  }

  private createS3Policy() {
    return new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:*'],
      resources: [`${this.s3Stack.apiBucket.bucketArn}/*`],
    });
  }

  private createLambdaPolicy() {
    return new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [
        `arn:aws:lambda:${this.props.env?.region}:${
          this.props.env?.account
        }:function:${getResourceNameWithPrefix('*')}`,
      ],
      actions: ['lambda:InvokeFunction'],
    });
  }

  private createSecretManagerPolicy() {
    return new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [
        getSecretArn({
          region: this.props.env?.region!,
          account: this.props.env?.account!,
          stage: this.props.stage,
        }),
      ],
      actions: ['secretsmanager:GetSecretValue'],
    });
  }

  private createLambdaRole() {
    return new Role(this, 'LambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        [getResourceNameWithPrefix(`lambda-role-policy-${this.props.stage}`)]: new PolicyDocument({
          statements: [
            this.dynamoPolicy,
            this.s3Policy,
            this.lambdaPolicy,
            this.secretManagerPolicy,
          ],
        }),
      },
    });
  }

  private outputValues() {
    new CfnOutput(this, 'LambdaRoleArn', {
      value: this.lambdaRole.roleArn,
      exportName: getResourceNameWithPrefix(`lambda-role-arn-${this.props.stage}`),
    });
  }
}
