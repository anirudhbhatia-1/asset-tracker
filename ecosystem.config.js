// PM2 process file for a VM deployment:
//   pm2 start ecosystem.config.js            (production settings)
//   pm2 reload ecosystem.config.js --update-env   (what scripts/deploy.sh runs)
// PM2 stops the API with SIGINT (then SIGKILL after kill_timeout); the server
// handles SIGINT/SIGTERM by finishing in-flight requests and closing the pool.
// Install log rotation once per VM: see production_checklist.md (pm2-logrotate).
// Settings such as DATABASE_URL and GOOGLE_* come from server/.env (loaded by
// server/loadEnv.js regardless of the working directory).
module.exports = {
  apps: [
    {
      name: 'assettrack-api',
      cwd: __dirname,
      script: './server/index.js',

      // One instance: the API is stateless, but keep it simple until needed.
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      watch: false,

      // Production is the default so a plain `pm2 start` never runs without
      // database SSL or the Google domain restriction.
      // PORT comes from server/.env (default 3001); HOST keeps the API off
      // the public interface on a VM behind nginx.
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        // The deployed commit, reported by GET /api/health. scripts/deploy.sh
        // exports it before `pm2 reload --update-env`; when unset the server
        // falls back to asking git.
        ...(process.env.GIT_COMMIT ? { GIT_COMMIT: process.env.GIT_COMMIT } : {}),
      },

      // Time allowed for a graceful shutdown before PM2 sends SIGKILL.
      kill_timeout: 10000,

      // PM2 creates these files; the directory must exist (see below).
      error_file: './logs/api-err.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};

// Make sure the log directory exists when PM2 loads this file.
require('fs').mkdirSync(require('path').join(__dirname, 'logs'), { recursive: true });
