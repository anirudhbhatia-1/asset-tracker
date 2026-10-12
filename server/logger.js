// One structured logger for the API. JSON lines by default (what log
// collectors expect); human-readable output only in development, and only
// when pino-pretty happens to be installed. LOG_LEVEL overrides the level.
const pino = require('pino');

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.passwordHash',
  '*.password_hash',
  '*.temporaryPassword',
  '*.token',
  '*.credential',
];

const hasPrettyTransport = () => {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
};

const defaultLevel = (environment) => {
  if (environment.LOG_LEVEL) return environment.LOG_LEVEL;
  // Tests assert on responses, not logs; keep their output readable.
  if (environment.NODE_ENV === 'test') return 'silent';
  return 'info';
};

// `destination` (a writable stream) is for tests.
const createLogger = (environment = process.env, destination = undefined) => {
  const options = {
    level: defaultLevel(environment),
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: { service: 'assettrack-api' },
  };
  if (destination) return pino(options, destination);
  if (environment.NODE_ENV === 'development' && hasPrettyTransport()) {
    options.transport = { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } };
  }
  return pino(options);
};

const logger = createLogger();

// pino-http request serializer. `ip` is Express's req.ip, which honours
// 'trust proxy' (the real client behind nginx), not the socket address.
const serializeRequest = (req) => ({
  id: req.id,
  method: req.method,
  url: req.url,
  ip: (req.raw && req.raw.ip) || req.ip || req.remoteAddress,
});

module.exports = logger;
module.exports.serializeRequest = serializeRequest;
module.exports.createLogger = createLogger;
module.exports.REDACT_PATHS = REDACT_PATHS;
