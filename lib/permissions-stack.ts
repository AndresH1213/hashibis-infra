import { CfnOutput, Stack, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BasicStackProps } from '../interfaces';
import {
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { getResourceNameWithPrefix, getSecretArn } from '../util';

export class PermissionStack extends Stack {
  props: BasicStackProps;
  dynamoPolicy: PolicyStatement;
  s3Policy: PolicyStatement;
  lambdaPolicy: PolicyStatement;
  secretManagerPolicy: PolicyStatement;
  lambdaRole: Role;

  medicalHistoryTableArn: string;
  personalInformationTableArn: string;
  productTableArn: string;
  orderTableArn: string;
  apiBucketArn: string;

  constructor(scope: Construct, id: string, props: BasicStackProps) {
    super(scope, id, props);
    this.props = props;
    this.importValues();
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
        this.medicalHistoryTableArn,
        `${this.medicalHistoryTableArn}/index/*`,
        this.personalInformationTableArn,
        `${this.personalInformationTableArn}/index/*`,
        this.productTableArn,
        `${this.productTableArn}/index/*`,
        this.orderTableArn,
        `${this.orderTableArn}/index/*`,
      ],
    });
  }

  private createS3Policy() {
    return new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:*'],
      resources: [`${this.apiBucketArn}/*`],
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

  private importValues() {
    this.medicalHistoryTableArn = Fn.importValue(
      getResourceNameWithPrefix(`medical-history-table-arn-${this.props.stage}`)
    );
    this.personalInformationTableArn = Fn.importValue(
      getResourceNameWithPrefix(`personal-information-table-arn-${this.props.stage}`)
    );
    this.productTableArn = Fn.importValue(
      getResourceNameWithPrefix(`product-table-arn-${this.props.stage}`)
    );
    this.orderTableArn = Fn.importValue(
      getResourceNameWithPrefix(`order-table-arn-${this.props.stage}`)
    );
    this.apiBucketArn = Fn.importValue(
      getResourceNameWithPrefix(`api-bucket-arn-${this.props.stage}`)
    );
  }

  private outputValues() {
    new CfnOutput(this, 'LambdaRoleArn', {
      value: this.lambdaRole.roleArn,
      exportName: getResourceNameWithPrefix(`lambda-role-arn-${this.props.stage}`),
    });
  }
}
