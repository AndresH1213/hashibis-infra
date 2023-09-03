import { Construct } from 'constructs';
import { DnsValidatedCertificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { CfnOutput, Stack } from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ARecord, HostedZone, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';

import { CognitoAuthorizer } from './auth/cognito-authorizer';
import { BasicStackProps } from '../interfaces';
import { getResourceNameWithPrefix } from '../util';

const DOMAIN_NAME = 'hashibis.site';

export class ApiGatewayStack extends Stack {
  public httpApi: apigatewayv2.CfnApi;
  public domainName: apigatewayv2.CfnDomainName;
  private hashibisCertificateArn: string;
  private apiGatewayAccessLogGroup: LogGroup;
  private props: BasicStackProps;

  private hostedZone: IHostedZone;

  constructor(scope: Construct, id: string, props: BasicStackProps) {
    super(scope, id, props);
    this.props = props;
    this.hostedZone = HostedZone.fromLookup(this, 'HashibisHostedZone', {
      domainName: DOMAIN_NAME,
    });

    this.hashibisCertificateArn = new DnsValidatedCertificate(this, 'DomainCertificate', {
      domainName: `api.${DOMAIN_NAME}`,
      subjectAlternativeNames: [`*.${DOMAIN_NAME}`],
      hostedZone: this.hostedZone,
      region: props.env?.region,
      validation: CertificateValidation.fromDns(),
    }).certificateArn;

    this.createApiGatewayAccessLoggingDestination();
    this.createDomainName();
    this.createHttpApi(props);
    this.addRoute53Record();
    new CognitoAuthorizer(this, this.httpApi, props);
  }

  private createApiGatewayAccessLoggingDestination() {
    this.apiGatewayAccessLogGroup = new LogGroup(this, 'ApiGwAccessLogginDestination', {
      logGroupName: getResourceNameWithPrefix(`api-gateway-logs-${this.props.stage}`),
      retention: RetentionDays.INFINITE,
    });
  }

  private createDomainName() {
    this.domainName = new apigatewayv2.CfnDomainName(this, 'ApiGatewayDomainName', {
      domainName: `api.${DOMAIN_NAME}`,
      domainNameConfigurations: [
        {
          certificateArn: this.hashibisCertificateArn,
          endpointType: 'REGIONAL',
          securityPolicy: 'TLS_1_2',
        },
      ],
    });
  }

  private createHttpApi(props: BasicStackProps) {
    this.httpApi = new apigatewayv2.CfnApi(this, 'HttpApi', {
      name: getResourceNameWithPrefix(`http-api-${props.stage}`),
      protocolType: 'HTTP',
      corsConfiguration: {
        allowCredentials: false,
        allowHeaders: ['*'],
        allowMethods: ['*'],
        allowOrigins: ['*'],
        exposeHeaders: ['*'],
      },
    });

    new apigatewayv2.CfnStage(this, 'HttpApiDefaultStage', {
      apiId: this.httpApi.ref,
      stageName: '$default',
      autoDeploy: true,
      defaultRouteSettings: {
        dataTraceEnabled: false,
        detailedMetricsEnabled: false,
      },
      accessLogSettings: {
        format: `{"requestId":"$context.requestId","ip":"$context.identity.sourceIp","requestTime":"$context.requestTime","httpMethod":"$context.httpMethod","routeKey":"$context.routeKey","status":"$context.status","protocol":"$context.protocol","responseLength":"$context.responseLength"}`,
        destinationArn: this.apiGatewayAccessLogGroup.logGroupArn,
      },
    });

    new apigatewayv2.CfnApiMapping(this, 'HttpApiMapping', {
      apiId: this.httpApi.ref,
      domainName: this.domainName.ref,
      stage: '$default',
    });

    new CfnOutput(this, 'OutputHttpApiId', {
      value: this.httpApi.ref,
      exportName: getResourceNameWithPrefix(`http-api-id-${props.stage}`),
    });
  }

  private addRoute53Record() {
    const record = new ARecord(this, 'ApiDomainAlias', {
      zone: this.hostedZone,
      recordName: 'api',
      target: RecordTarget.fromAlias({
        bind: () => ({
          dnsName: this.domainName.attrRegionalDomainName,
          hostedZoneId: this.domainName.attrRegionalHostedZoneId,
        }),
      }),
    });

    new CfnOutput(this, 'ApiGatewayDomainAlias', {
      value: record.domainName,
      exportName: getResourceNameWithPrefix(`api-gateway-domain-alias-${this.props.stage}`),
    });
  }
}
