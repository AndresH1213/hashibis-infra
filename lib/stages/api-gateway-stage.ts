import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

import { BasicStackProps } from '../../interfaces';
import * as Util from '../../util';
import { ApiGatewayStack } from '../api-gateway-stack';

export class ApiGatewayStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: BasicStackProps) {
    super(scope, id, props);

    new ApiGatewayStack(this, `apigateway-${props?.stage}`, {
      env: {
        region: props?.env?.region,
        account: props?.env?.account,
      },
      stage: props?.stage || 'dev',
      name: Util.getStackNameWithPrefix(`apigateway-${props?.stage}`),
    });
  }
}
