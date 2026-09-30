// Global Express error handler
module.exports = (err, req, res, next) => {
  // Multer rejects oversized or malformed uploads without a status code.
  const statusCode = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
  const message = err.message || 'Internal Server Error';

  if (statusCode === 500) {
    console.error('Unhandled Error:', err);
  }

  res.status(statusCode).json({
    error: true,
    message,
    code: statusCode,
  });
};
