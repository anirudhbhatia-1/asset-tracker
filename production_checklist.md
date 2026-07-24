# AssetTrack v1.0 Production Deployment Checklist

Before exposing AssetTrack to the internal network or the public internet, verify the following:

## 1. Environment Configuration
- [ ] Ensure `.env` is NOT checked into source control.
- [ ] Set `NODE_ENV=production` on the production server.
- [ ] Update `VITE_API_BASE_URL` in the frontend `.env` to point to the production backend (e.g., `https://assettrack.company.internal/api`).
- [ ] Set a strong, randomly generated secret for authentication (if implemented) in the backend `.env`.

## 2. Security & HTTPS
- [ ] **HTTPS/TLS**: The application must be served over HTTPS. Use a reverse proxy (like Nginx or Caddy) to handle SSL certificates (e.g., Let's Encrypt or an internal CA).
- [ ] **Firewall**: Ensure only necessary ports (80, 443) are exposed if using a reverse proxy. The Node.js application port (e.g., 3000) should be bound to `localhost` or restricted by security groups.
- [ ] **CORS**: Verify `cors` middleware in `server.js` is configured to ONLY allow requests from your specific frontend origin, instead of `*`.

## 3. Database Management (SQLite)
- [ ] Ensure the SQLite database file (`assettrack.sqlite` or similar) is stored outside of the ephemeral deployment directory, or in a persistent volume, so data is not lost during application restarts or updates.
- [ ] **Backups**: Setup a daily cron job to back up the SQLite database file.
  - Example: `0 2 * * * cp /path/to/assettrack.sqlite /path/to/backups/assettrack_$(date +\%F).sqlite`

## 4. Process Management
- [ ] Use a process manager like **PM2** or a container orchestrator like **Docker/Kubernetes** to run the backend server.
  - Example: `pm2 start server.js --name "assettrack-api"`
- [ ] Ensure the Node.js process is configured to automatically restart on crash or server reboot.

## 5. Build & Serve
- [ ] Run `npm run build` in the `client/` directory to generate the optimized static bundle.
- [ ] Serve the `client/dist/` directory using a static file server (e.g., Nginx) or configure the Node.js backend to serve the static files in production.
