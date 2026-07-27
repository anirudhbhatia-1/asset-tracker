# AssetTrack v1.0 Production Deployment Checklist

Before exposing AssetTrack to the internal network or the public internet, verify the following:

## 1. Environment Configuration
- [ ] Ensure `.env` is NOT checked into source control. *(Verified: `.gitignore` includes `.env`)*
- [x] Set `NODE_ENV=production` on the production server. *(Handled by `ecosystem.config.js` or `server/.env.production.example`)*
- [x] Update `VITE_API_BASE_URL` in the frontend `.env` to point to the production backend (e.g., `https://assettrack.company.internal/api`).
- [x] Set a strong, randomly generated secret for authentication (if implemented) in the backend `.env`. *(Template provided in `server/.env.production.example`)*

## 2. Security & HTTPS
- [x] **HTTPS/TLS**: The application must be served over HTTPS. Use a reverse proxy (like Nginx or Caddy) to handle SSL certificates (e.g., Let's Encrypt or an internal CA). *(Boilerplate provided in `nginx.conf.example`)*
- [x] **Firewall**: Ensure only necessary ports (80, 443) are exposed if using a reverse proxy. The Node.js application port (e.g., 3000) should be bound to `localhost` or restricted by security groups. *(Nginx proxies to `127.0.0.1:3001` in the example)*
- [x] **CORS**: Verify `cors` middleware in `server.js` is configured to ONLY allow requests from your specific frontend origin, instead of `*`. *(Verified in `server/index.js` using `CLIENT_ORIGIN`)*

## 3. Database Management (SQLite)
- [ ] Ensure the SQLite database file (`assettrack.sqlite` or similar) is stored outside of the ephemeral deployment directory, or in a persistent volume, so data is not lost during application restarts or updates.
- [x] **Backups**: Setup a daily cron job to back up the SQLite database file. *(Script provided in `scripts/backup_db.sh`)*
  - Example cron: `0 2 * * * /var/www/assettrack/scripts/backup_db.sh`

## 4. Process Management
- [x] Use a process manager like **PM2** or a container orchestrator like **Docker/Kubernetes** to run the backend server. *(Config provided in `ecosystem.config.js`)*
  - Command: `pm2 start ecosystem.config.js --env production`
- [x] Ensure the Node.js process is configured to automatically restart on crash or server reboot. *(Handled by PM2 `autorestart: true`)*

## 5. Build & Serve
- [ ] Run `npm run build` in the `client/` directory to generate the optimized static bundle.
- [x] Serve the `client/dist/` directory using a static file server (e.g., Nginx) or configure the Node.js backend to serve the static files in production. *(Handled by `nginx.conf.example`)*
