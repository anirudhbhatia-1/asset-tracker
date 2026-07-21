const { validationResult } = require('express-validator');

// express-validator error handler middleware
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      error: true,
      message: `${firstError.path || firstError.param}: ${firstError.msg}`,
      code: 400,
      errors: errors.array(),
    });
  }
  next();
};
