export function validateEnvironmentVariables() {
  const gitHub = {
    gitHubOwner: process.env.GITHUB_OWNER,
    gitHubRepoInfra: process.env.GITHUB_REPO_INFRA,
    gitHubRepoBackend: process.env.GITHUB_REPO_BACKEND,
  };

  for (const [key, value] of Object.entries(gitHub)) {
    if (!value) {
      throw new Error(`Please specify a valid ${key}`);
    }
  }
}

export function getEnvironment(stage: string) {
  if (!['dev', 'prod'].includes(stage)) {
    throw new Error('Please specify a valid environment');
  }

  let account = '';
  let region = '';

  switch (stage) {
    case 'dev':
      account = process.env.AWS_ACCOUNT_ID_DEV || process.env.CDK_DEFAULT_ACCOUNT || '';
      region = process.env.AWS_REGION_DEV || process.env.CDK_DEFAULT_REGION || '';
      break;
    case 'prod':
      account = process.env.AWS_ACCOUNT_ID_PROD || process.env.CDK_DEFAULT_ACCOUNT || '';
      region = process.env.AWS_REGION_PROD || process.env.CDK_DEFAULT_REGION || '';
      break;
  }

  if (!account || !region) {
    throw new Error('Account or region not defined');
  }

  return { account, region };
}
