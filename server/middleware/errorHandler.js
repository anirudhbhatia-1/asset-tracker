const logger = require('../logger');
const { captureException } = require('../sentry');

// Postgres errors that mean "bad request" rather than "server broke".
const PG_ERROR_RESPONSES = {
  23505: [409, 'This record already exists (duplicate value).'],
  23503: [400, 'This refers to a record that does not exist or is still in use.'],
  23514: [400, 'A value is not allowed here.'],
  '22P02': [400, 'A value has the wrong format.'],
  22007: [400, 'A date or time value is invalid.'],
  22008: [400, 'A date or time value is out of range.'],
  22003: [400, 'A number is out of range.'],
  22001: [400, 'A value is too long.'],
  // Two changes collided (deadlock / serialization failure); nothing was
  // saved, and doing it again normally works.
  '40P01': [409, 'Someone else changed this at the same moment. Nothing was saved — please try again.'],
  40001: [409, 'Someone else changed this at the same moment. Nothing was saved — please try again.'],
};

// Global Express error handler
module.exports = (err, req, res, next) => {
  const pgResponse = !err.statusCode && PG_ERROR_RESPONSES[err.code];
  const statusCode = err.statusCode
    || (pgResponse && pgResponse[0])
    || (err.name === 'MulterError' ? 400 : 500);

  if (statusCode >= 500) {
    (req.log || logger).error({ err }, 'Unhandled Error');
    captureException(err, { method: req.method, route: req.route?.path || req.baseUrl || req.path });
  }

  // Unexpected failures can carry internal details (SQL, constraint names);
  // only show them outside production.
  let message = err.message || 'Internal Server Error';
  if (pgResponse) message = pgResponse[1];
  // Only development and test show internal details; anything else (including
  // a production server with NODE_ENV unset) gets the generic message.
  if (statusCode === 500 && !['development', 'test'].includes(process.env.NODE_ENV)) {
    message = 'Something went wrong. Please try again.';
  }

  res.status(statusCode).json({
    error: true,
    message,
    code: statusCode,
    // A reason code is for the client to act on (e.g. ACCOUNT_LOCKED); only
    // a string on a 4xx is passed through, never internals of a 5xx.
    ...(typeof err.reason === 'string' && err.reason && statusCode < 500 ? { reason: err.reason } : {}),
    ...(err.details ? { details: err.details } : {}),
  });
};
