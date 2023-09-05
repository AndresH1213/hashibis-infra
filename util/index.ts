import { readFileSync } from 'fs';
import { getEnvironment } from './bootstrap';

export function getResourceNameWithPrefix(resourceName: string) {
  return `api-hashibis-${resourceName}`;
}

export function getStackNameWithPrefix(resourceName: string) {
  return `api-hashibis-infra-${resourceName}`;
}

export function camelCaseToSnakeCase(str: string) {
  str = str[0].toLowerCase() + str.slice(1);
  return str.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`);
}

export function getGithubBranchName(stage: string) {
  switch (stage) {
    case 'dev':
      return 'main'; //testing
    case 'prod':
      return 'main';
    default:
      throw new Error('Please specify a valid environment');
  }
}

type secretProps = {
  region: string;
  account: string;
  stage: string;
};

export function getSecretArn(props: secretProps) {
  const baseArnStr = 'arn:aws:secretsmanager';
  const secretIdEnv =
    props.stage === 'prod' ? process.env.AWS_SECRET_ID_PROD : process.env.AWS_SECRET_ID_DEV;
  const secretId = secretIdEnv || process.env.AWS_SECRET_ID;
  return `${baseArnStr}:${props.region}:${props.account}:secret:${secretId}`;
}

export const verificationEmail = {
  subject: 'Verify your email for Hashibis',
  body: readFileSync('./assets/email-template.html').toString('utf-8'),
};

export { getEnvironment };
