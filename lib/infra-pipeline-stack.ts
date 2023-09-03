import { Construct } from 'constructs';
import { Stack, SecretValue } from 'aws-cdk-lib';
import { BasicStackProps } from '../interfaces';
import { getResourceNameWithPrefix, getGithubBranchName, getSecretArn } from '../util';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { ApiGatewayStage } from './stages/api-gateway-stage';
import { DynamoStage } from './stages/dynamo-stage';
import { BucketStage } from './stages/bucket-stage';
import { PermissionsStage } from './stages/permissions-stage';

export class InfraPipelineStack extends Stack {
  private pipeline: pipelines.CodePipeline;
  private props: BasicStackProps;
  constructor(scope: Construct, id: string, props: BasicStackProps) {
    super(scope, id, props);
    this.props = props;

    this.createPipeline(props);
  }

  private createPipeline(props: BasicStackProps) {
    const gitHubOwner = process.env.GITHUB_OWNER;
    const gitHubInfra = process.env.GITHUB_REPO_INFRA;
    this.pipeline = new pipelines.CodePipeline(this, 'InfraPipeline', {
      pipelineName: getResourceNameWithPrefix(`infra-pipeline-${props.stage}`),
      codeBuildDefaults: {
        buildEnvironment: {
          environmentVariables: {
            ENV: { value: props.stage },
            AWS_ACCOUNT_ID: { value: props.env?.account },
            AWS_REGION_ID: { value: props.env?.region },
          },
        },
      },
      selfMutation: true,
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.gitHub(
          `${gitHubOwner}/${gitHubInfra}}`,
          getGithubBranchName(props.stage),
          {
            authentication: SecretValue.secretsManager(
              getSecretArn({
                region: this.props.env?.region!,
                account: this.props.env?.account!,
                stage: this.props.stage,
              }),
              {
                jsonField: 'GITHUB_TOKEN',
              }
            ),
          }
        ),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    this.pipeline.addStage(new ApiGatewayStage(this, 'ApiGwStage', props));
    const persistenceResourcesWave = this.pipeline.addWave('PersistenceResources');

    const dynamoStage = new DynamoStage(this, 'DynamoStage', props);
    const bucketStage = new BucketStage(this, 'BucketStage', props);
    persistenceResourcesWave.addStage(dynamoStage);
    persistenceResourcesWave.addStage(bucketStage);

    const permissionProps = {
      ...props,
      stacks: {
        dynamo: dynamoStage.stack,
        bucket: bucketStage.stack,
      },
    };
    this.pipeline.addStage(new PermissionsStage(this, 'PermissionStage', permissionProps));
    this.pipeline.buildPipeline();
  }
}
