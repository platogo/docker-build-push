const cp = require('child_process');
const core = require('@actions/core');
const fs = require('fs');
const { context } = require('@actions/github');
const cpOptions = require('./settings');

const isGitHubTag = ref => ref && ref.includes('refs/tags/');

const isMasterBranch = ref => ref && ref === 'refs/heads/master';

const isNotMasterBranch = ref => ref && ref.includes('refs/heads/') && ref !== 'refs/heads/master';

const createTag = () => {
  core.info('Creating Docker image tag...');
  const { sha } = context;

  let dockerTag;
  dockerTag = sha;

  core.info(`Docker tag created: ${dockerTag}`);
  return dockerTag;
};

const createBuildCommand = (dockerfile, imageName, buildDir, buildArgs) => {
  let buildCommandPrefix = `docker build -f ${dockerfile} -t ${imageName}`;
  if (buildArgs) {
    const argsSuffix = buildArgs.map(arg => `--build-arg ${arg}`).join(' ');
    buildCommandPrefix = `${buildCommandPrefix} ${argsSuffix}`;
  }

  return `${buildCommandPrefix} ${buildDir}`;
};

const build = (imageName, buildArgs) => {
  const dockerfile = core.getInput('dockerfile');
  const buildDir = core.getInput('directory') || '.';

  if (!fs.existsSync(dockerfile)) {
    core.setFailed(`Dockerfile does not exist in location ${dockerfile}`);
  }

  core.info(`Building Docker image: ${imageName}`);
  cp.execSync(createBuildCommand(dockerfile, imageName, buildDir, buildArgs), cpOptions);
};

const isEcr = registry => registry && registry.includes('amazonaws');

const getRegion = registry => registry.substring(registry.indexOf('ecr.') + 4, registry.indexOf('.amazonaws'));

const isWindows = () => process.env.RUNNER_OS === 'Windows';

const login = () => {
  const registry = core.getInput('registry', { required: true });
  const username = core.getInput('username');
  const password = core.getInput('password');

  // If using ECR, use the AWS CLI login command in favor of docker login
  if (isEcr(registry)) {
    const region = getRegion(registry);
    core.info(`Logging into ECR region ${region}...`);

    // Determine whether to run bash or PowerShell version of login command
    if (isWindows()) {
      cp.execSync(
        `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${registry}`
      );
    } else {
      cp.execSync(`$(aws ecr get-login --region ${region} --no-include-email)`);
    }
  } else if (username && password) {
    core.info(`Logging into Docker registry ${registry}...`);
    cp.execSync(`docker login -u ${username} --password-stdin ${registry}`, {
      input: password
    });
  }
};

const push = imageName => {
  core.info(`Pushing Docker image ${imageName}`);
  cp.execSync(`docker push ${imageName}`, cpOptions);
};

module.exports = {
  createTag,
  build,
  login,
  push
};
