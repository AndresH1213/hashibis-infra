import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

import { BasicStackProps } from '../../interfaces';
import * as Util from '../../util';
import { PermissionStack } from '../permissions-stack';

export class PermissionsStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: BasicStackProps) {
    super(scope, id, props);

    new PermissionStack(this, `permission-${props?.stage}`, {
      env: {
        region: props?.env?.region,
        account: props?.env?.account,
      },
      stage: props?.stage || 'dev',
      name: Util.getStackNameWithPrefix(`permission-${props?.stage}`),
    });
  }
}
