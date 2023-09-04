import { Construct } from 'constructs';
import { Stack, SecretValue } from 'aws-cdk-lib';
import { BasicStackProps } from '../interfaces';
import { getResourceNameWithPrefix, getGithubBranchName, getSecretArn } from '../util';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { ApiGatewayStage } from './stages/api-gateway-stage';
import { DynamoStage } from './stages/dynamo-stage';
import { BucketStage } from './stages/bucket-stage';
import { PermissionsStage } from './stages/permissions-stage';
import { GitHubTrigger } from 'aws-cdk-lib/aws-codepipeline-actions';

export class InfraPipelineStack extends Stack {
  private pipeline: pipelines.CodePipeline;
  private props: BasicStackProps;
  constructor(scope: Construct, id: string, props: BasicStackProps) {
    super(scope, id, props);
    this.props = props;

    this.createPipeline();
  }

  private createPipeline() {
    const gitHubOwner = process.env.GITHUB_OWNER;
    const gitHubInfra = process.env.GITHUB_REPO_INFRA;
    const githubSecret = SecretValue.secretsManager(
      getSecretArn({
        region: this.props.env?.region!,
        account: this.props.env?.account!,
        stage: this.props.stage,
      }),
      {
        jsonField: 'GITHUB_TOKEN',
      }
    );
    console.log('github', githubSecret.unsafeUnwrap().toString());
    this.pipeline = new pipelines.CodePipeline(this, 'InfraPipeline', {
      pipelineName: getResourceNameWithPrefix(`infra-pipeline-${this.props.stage}`),
      codeBuildDefaults: {
        buildEnvironment: {
          environmentVariables: {
            ENV: { value: this.props.stage },
            AWS_ACCOUNT_ID: { value: this.props.env?.account },
            AWS_REGION_ID: { value: this.props.env?.region },
          },
        },
      },
      selfMutation: true,
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.gitHub(
          `${gitHubOwner}/${gitHubInfra}}`,
          getGithubBranchName(this.props.stage),
          {
            authentication: githubSecret,
            trigger: GitHubTrigger.WEBHOOK,
          }
        ),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    this.pipeline.addStage(new ApiGatewayStage(this, 'ApiGwStage', this.props));
    const persistenceResourcesWave = this.pipeline.addWave('PersistenceResources');

    const dynamoStage = new DynamoStage(this, 'DynamoStage', this.props);
    const bucketStage = new BucketStage(this, 'BucketStage', this.props);
    persistenceResourcesWave.addStage(dynamoStage);
    persistenceResourcesWave.addStage(bucketStage);

    this.pipeline.addStage(new PermissionsStage(this, 'PermissionStage', this.props));
    this.pipeline.buildPipeline();
  }
}
