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
};

// Global Express error handler
module.exports = (err, req, res, next) => {
  const pgResponse = !err.statusCode && PG_ERROR_RESPONSES[err.code];
  const statusCode = err.statusCode
    || (pgResponse && pgResponse[0])
    || (err.name === 'MulterError' ? 400 : 500);

  if (statusCode === 500) {
    console.error('Unhandled Error:', err);
  }

  // Unexpected failures can carry internal details (SQL, constraint names);
  // only show them outside production.
  let message = err.message || 'Internal Server Error';
  if (pgResponse) message = pgResponse[1];
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Something went wrong. Please try again.';
  }

  res.status(statusCode).json({
    error: true,
    message,
    code: statusCode,
    ...(err.details ? { details: err.details } : {}),
  });
};
