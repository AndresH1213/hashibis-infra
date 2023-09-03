import { StackProps } from 'aws-cdk-lib';
import { DynamoStack } from '../lib/dynamo-stack';
import { BucketStack } from '../lib/bucket-stack';

export interface EnvConfig extends StackProps {
  stage: string;
}

export interface BasicStackProps extends EnvConfig {
  name: string;
}

export interface PermissionStackProps extends BasicStackProps {
  stacks: {
    dynamo: DynamoStack;
    bucket: BucketStack;
  };
}
