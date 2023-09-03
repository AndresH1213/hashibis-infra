import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

import { BasicStackProps } from '../../interfaces';
import * as Util from '../../util';
import { BucketStack } from '../bucket-stack';

export class BucketStage extends cdk.Stage {
  public stack: BucketStack;
  constructor(scope: Construct, id: string, props?: BasicStackProps) {
    super(scope, id, props);

    this.stack = new BucketStack(this, `bucket-${props?.stage}`, {
      env: {
        region: props?.env?.region,
        account: props?.env?.account,
      },
      stage: props?.stage || 'dev',
      name: Util.getStackNameWithPrefix(`bucket-${props?.stage}`),
    });
  }
}
