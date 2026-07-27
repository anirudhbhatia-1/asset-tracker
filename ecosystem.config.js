module.exports = {
  apps: [
    {
      name: 'assettrack-api',
      script: './server/index.js',
      
      // Scale across CPU cores (if applicable, though SQLite works best with 1 instance to avoid locking issues)
      instances: 1, 
      
      // Auto restart if the app crashes
      autorestart: true,
      
      // Restart if memory exceeds 300MB
      max_memory_restart: '300M',
      
      // Watch for file changes (disabled in production)
      watch: false,
      
      // Environment variables for standard operation
      env: {
        NODE_ENV: 'development'
      },
      
      // Environment variables for production (used via `pm2 start ecosystem.config.js --env production`)
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      
      // Logs
      error_file: './logs/api-err.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    }
  ]
};
