import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { BasicStackProps } from '../interfaces';
import { getResourceNameWithPrefix, getGithubBranchName } from '../util';
import {
  PipelineProject,
  LinuxBuildImage,
  ComputeType,
  BuildSpec,
  BuildEnvironmentVariableType,
} from 'aws-cdk-lib/aws-codebuild';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import {
  CodeBuildAction,
  CodeStarConnectionsSourceAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';

export class BackendPipelineStack extends cdk.Stack {
  public buildProject: PipelineProject;
  public deployProject: PipelineProject;
  public pipeline: Pipeline;
  private slackNotificationTopic: sns.ITopic;
  private props: BasicStackProps;

  constructor(scope: Construct, id: string, props: BasicStackProps) {
    super(scope, id, props);
    this.props = props;
    this.createBuildProject();
    this.createDeployProject();
    this.createCodePipeline();
  }

  private createBuildProject() {
    this.buildProject = new PipelineProject(this, 'BackendBuildProject', {
      projectName: getResourceNameWithPrefix(`backend-build-project-${this.props.stage}`),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_5_0,
        computeType: ComputeType.MEDIUM,
      },
      buildSpec: BuildSpec.fromSourceFilename('build-specs/services-build-spec.yml'),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, `BackendBuildLogGroup`, {
            logGroupName: getResourceNameWithPrefix(`backend-build-project-log`),
            retention: logs.RetentionDays.ONE_DAY,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        },
      },
    });

    const policyStatement = new iam.PolicyStatement();
    policyStatement.addResources('*');
    policyStatement.addActions('*');
    this.buildProject.addToRolePolicy(policyStatement);
  }

  private createDeployProject() {
    this.deployProject = new PipelineProject(this, 'BackendDeployProject', {
      projectName: getResourceNameWithPrefix(`backend-deploy-project-${this.props.stage}`),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_5_0,
        computeType: ComputeType.MEDIUM,
      },
      environmentVariables: {
        STAGE: {
          value: this.props.stage,
          type: BuildEnvironmentVariableType.PLAINTEXT,
        },
      },
      buildSpec: BuildSpec.fromSourceFilename('build-specs/services-deploy-spec.yml'),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, `BackendDeployLogGroup`, {
            logGroupName: getResourceNameWithPrefix(`backend-deploy-project-log`),
            retention: logs.RetentionDays.ONE_DAY,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        },
      },
    });

    const policyStatement = new iam.PolicyStatement();
    policyStatement.addResources('*');
    policyStatement.addActions('*');
    this.deployProject.addToRolePolicy(policyStatement);
  }

  private createCodePipeline() {
    const artifact1 = new Artifact(`codepipeline_artifact1`);
    const artifact2 = new Artifact(`codepipeline_artifact2`);

    const sourceAction = new CodeStarConnectionsSourceAction({
      actionName: 'Github_Source',
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO_BACKEND!,
      output: artifact1,
      connectionArn: cdk.Fn.importValue(
        getResourceNameWithPrefix(`connection-arn-${this.props.stage}`)
      ),
      branch: getGithubBranchName(this.props.stage),
    });

    const buildAction = new CodeBuildAction({
      actionName: 'CodeBuild',
      project: this.buildProject,
      input: artifact1,
      outputs: [artifact2],
    });

    const deployAction = new CodeBuildAction({
      actionName: 'CodeDeploy',
      project: this.deployProject,
      input: artifact2,
    });

    this.pipeline = new Pipeline(this, 'BackendPipeline', {
      pipelineName: getResourceNameWithPrefix(`backend-pipeline-${this.props.stage}`),
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Build',
          actions: [buildAction],
        },
        {
          stageName: 'Deploy',
          actions: [deployAction],
        },
      ],
    });

    this.pipeline.notifyOnExecutionStateChange(
      'NotifyPipelineExecution',
      this.slackNotificationTopic
    );
  }
}
