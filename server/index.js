require('./loadEnv');
const { initSentry, flushSentry } = require('./sentry');

initSentry();

const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const db = require('./db');
const logger = require('./logger');
const buildInfo = require('./buildInfo');
const errorHandler = require('./middleware/errorHandler');
const { securityHeaders, createApiLimiter, createApiIpLimiter } = require('./middleware/security');
const { getGoogleAuthConfigProblem, normalizeAllowedDomain } = require('./services/googleService');

const app = express();
const PORT = process.env.PORT || 3001;
// Optional bind address: set HOST=127.0.0.1 on a VM behind nginx; leave it
// unset on hosting platforms, which route traffic to all interfaces.
const HOST = process.env.HOST || undefined;

// When deployed behind a known reverse proxy (for example the supplied Nginx
// config), trust only the configured number of proxy hops so rate limits use
// the real client IP without accepting arbitrary forwarded headers.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0 && trustProxyHops <= 10) {
  app.set('trust proxy', trustProxyHops);
}

// Middlewares
app.use(securityHeaders());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(pinoHttp({
  logger,
  // Health checks from monitors would drown out everything else.
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: logger.serializeRequest,
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));
app.use(express.json());
// Per-IP ceiling first (fake tokens can't dodge it), then per session.
app.use('/api', createApiIpLimiter(), createApiLimiter());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const info = { version: buildInfo.version, commit: buildInfo.commit, startedAt: buildInfo.startedAt };
  try {
    await db.pingDatabase();
    res.status(200).json({ status: 'ok', ...info, database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', ...info, database: 'unavailable' });
  }
});

// Route Mounting
app.use('/api/assets', require('./routes/assets'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/history', require('./routes/history'));
app.use('/api/serial', require('./routes/serial'));
app.use('/api/google', require('./routes/google'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/offboarding', require('./routes/offboarding'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/search', require('./routes/search'));
app.use('/api/dashboard', require('./routes/dashboard'));
// Read-only feed for the People Portal; off unless PEOPLE_PORTAL_API_KEY is set.
app.use('/api/integration', require('./routes/integration'));

// 404 Handler for unmatched routes
app.use((req, res, next) => {
  res.status(404).json({
    error: true,
    message: 'Not found',
    code: 404,
  });
});

// Global Error Handler
app.use(errorHandler);

let server;
if (require.main === module) {
  server = app.listen(PORT, HOST, (err) => {
    // Express 5 reports listen failures (e.g. port in use) here, not as a throw.
    if (err) {
      logger.fatal(err.code === 'EADDRINUSE'
        ? `Port ${PORT} is already in use. Is another copy of the API running? Stop it, or set PORT to a free port.`
        : `Could not start the API: ${err.message}`);
      process.exit(1);
    }
    logger.info(`Server listening on port ${PORT} (version ${buildInfo.version}, commit ${buildInfo.commit})`);
    const googleProblem = getGoogleAuthConfigProblem();
    if (googleProblem) {
      logger.warn(`Google sign-in is DISABLED: ${googleProblem}`);
    } else {
      const domain = normalizeAllowedDomain(process.env.GOOGLE_ALLOWED_DOMAIN);
      logger.info(`Google sign-in enabled${domain ? ` for @${domain} accounts` : ' for any verified Google account'}`);
    }
    // Every minute: move/alert on High/Urgent tickets nobody has picked up.
    require('./services/ticketEscalationService').startEscalationWorker();
    require('./services/authService').startSessionCleanup();
    require('./utils/uploadTmp').sweepUploadTmp();
  });
}

// Graceful shutdown: stop accepting connections, let in-flight requests
// finish, close the database pool, then exit. A hung shutdown is cut off
// after SHUTDOWN_TIMEOUT_MS.
const SHUTDOWN_TIMEOUT_MS = 10000;
let shuttingDown = false;

const shutdown = (signal, { exit = process.exit, httpServer = server, pool = db.pool } = {}) => {
  if (shuttingDown) return Promise.resolve();
  shuttingDown = true;
  logger.info(`${signal} received: shutting down`);

  const forceTimer = setTimeout(() => {
    logger.error(`Shutdown took longer than ${SHUTDOWN_TIMEOUT_MS / 1000}s; forcing exit`);
    exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  const closeServer = () => new Promise((resolve) => {
    if (!httpServer) return resolve();
    httpServer.close(() => resolve());
    // Idle keep-alive sockets would otherwise hold close() open.
    if (typeof httpServer.closeIdleConnections === 'function') httpServer.closeIdleConnections();
  });

  return closeServer()
    .then(() => { logger.info('HTTP server closed'); return pool.end(); })
    .then(() => { logger.info('Postgres pool closed'); return flushSentry(); })
    .then(() => { clearTimeout(forceTimer); exit(0); })
    .catch((err) => {
      logger.error({ err }, 'Error during shutdown');
      clearTimeout(forceTimer);
      exit(1);
    });
};

if (require.main === module) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
module.exports.shutdown = shutdown;
module.exports.resetShutdownForTests = () => { shuttingDown = false; };
