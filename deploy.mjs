import { $, cd } from 'zx';

$.verbose = true;
const { SERVER_USER, SERVER_HOST, PORT, UPLOAD_SERVER_PATH, REPO_URL, FE_DIR, BRANCH } =
  process.env;
const ROOT = 'ROOT';
const start = Date.now();

try {
  const targetDir = '../tmp/zx';
  await $`mkdir -p ${targetDir}`;
  cd(targetDir);

  await $`git clone -b ${BRANCH} ${REPO_URL} ${ROOT}`;
  await $`mkdir -p frontend_build`;
  cd(ROOT);
  await $`cp -fr ./${FE_DIR}/. ../frontend_build`;
  await $`mv ./.git ../frontend_build/`;
  cd('../frontend_build');
  await $`yarn install`;
  await $`yarn build`;

  cd('dist');
  await $`touch deploy.txt`;

  const branch = (await $`git branch --show-current`).stdout.trim();
  const commitHash = (await $`git rev-parse HEAD`).stdout.trim();
  const commitMessage = (await $`git log -1 --pretty=%B`).stdout.trim();
  const commitAuthor = (await $`git log -1 --pretty=format:'%an <%ae>'`).stdout.trim();
  const deployer = (await $`git config user.name`).stdout.trim();
  const currentTime = new Date().toLocaleString();

  await $`echo Branch: ${branch} >> deploy.txt`;
  await $`echo Commit: ${commitHash} >> deploy.txt`;
  await $`echo Message: ${commitMessage} >> deploy.txt`;
  await $`echo Commiter: ${commitAuthor} >> deploy.txt`;
  await $`echo Deployer: ${deployer} >> deploy.txt`;
  await $`echo Time: ${currentTime} >> deploy.txt`;

  cd('../');
  await $`tar -czf dist.tar.gz ./dist`;
  await $`scp -P ${PORT} ./dist.tar.gz ${SERVER_USER}@${SERVER_HOST}:${UPLOAD_SERVER_PATH}/dist.tar.gz`;

  await $`
    ssh -p ${PORT} ${SERVER_USER}@${SERVER_HOST} '
    cd ${UPLOAD_SERVER_PATH} &&
    tar -xzf dist.tar.gz &&
    rm dist.tar.gz &&
    rm -rf ../assets/* &&
    mv ./dist/* ../assets/ &&
    rm -rf ./dist
    '
  `;

  await $`find src -mindepth 1 -maxdepth 1 ! -name '.umi-production' -exec rm -rf {} +`;
  await $`find . -mindepth 1 -maxdepth 1 ! -name 'src' ! -name 'dist' ! -name 'node_modules' -exec rm -rf {} +`;
  await $`rm -rf ../${ROOT}`;
  console.log(`Deploy Success Done ${((Date.now() - start) / 1000).toFixed(2)}s`);
} catch (error) {
  console.log('Deploy failed: ', error);
}
