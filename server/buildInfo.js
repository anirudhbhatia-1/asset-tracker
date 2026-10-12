// What is running: package version, git commit and start time. Read once at
// startup. GIT_COMMIT (set by the deploy) wins over asking git, which may be
// missing on the host; anything that fails gives 'unknown'.
const { execFileSync } = require('child_process');
const { version } = require('./package.json');

const readCommit = (environment = process.env, run = execFileSync) => {
  if (environment.GIT_COMMIT) return String(environment.GIT_COMMIT).trim().slice(0, 40);
  try {
    const output = run('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: __dirname,
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return String(output).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
};

module.exports = {
  version,
  commit: readCommit(),
  startedAt: new Date().toISOString(),
  readCommit,
};
