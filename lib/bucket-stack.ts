import { Stack, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BasicStackProps } from '../interfaces';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { getResourceNameWithPrefix } from '../util';

export class BucketStack extends Stack {
  props: BasicStackProps;
  public readonly apiBucket: Bucket;

  constructor(scope: Construct, id: string, props: BasicStackProps) {
    super(scope, id, props);
    this.props = props;
    this.apiBucket = this.createApiBucket();
    this.createOutput();
  }

  private createApiBucket() {
    return new Bucket(this, 'ApiBucket', {
      bucketName: getResourceNameWithPrefix(`bucket-${this.props.stage}`),
    });
  }

  private createOutput() {
    new CfnOutput(this, 'ApiBucketOutput', {
      value: this.apiBucket.bucketName,
      exportName: getResourceNameWithPrefix(`bucket-name-${this.props.stage}`),
    });

    new CfnOutput(this, 'ApiBucketArnOutput', {
      value: this.apiBucket.bucketArn,
      exportName: getResourceNameWithPrefix(`api-bucket-arn-${this.props.stage}`),
    });
  }
}
