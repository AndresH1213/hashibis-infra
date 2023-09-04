import { StackProps } from 'aws-cdk-lib';

export interface EnvConfig extends StackProps {
  stage: string;
}

export interface BasicStackProps extends EnvConfig {
  name: string;
}
