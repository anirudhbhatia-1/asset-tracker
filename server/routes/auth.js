const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { validateSession } = require('../middleware/validateSession');
const authService = require('../services/authService');

const router = express.Router();

// Slows password guessing; successful logins don't use up the allowance, so a
// shared office network isn't locked out by normal use.
const createPasswordLoginLimiter = (overrides = {}) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: true, message: 'Too many failed login attempts. Please try again in 15 minutes.', code: 429 },
  ...overrides,
});
const passwordLoginLimiter = createPasswordLoginLimiter();

// Every refused password sign-in (401 or 423) takes at least this long,
// measured from the start of the handler, so the response time doesn't tell
// apart unknown emails, older cheaper hashes and locked accounts.
// Successful sign-ins are not delayed.
const FAILED_LOGIN_MIN_MS = Number(process.env.LOGIN_FAILURE_MIN_MS) || 350;
const PADDED_STATUSES = new Set([401, 423]);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const padFailure = async (startedAt, minMs = FAILED_LOGIN_MIN_MS) => {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
};

router.post('/login', passwordLoginLimiter, [
  body('email').isString().bail().isEmail().withMessage('Valid email is required'),
  // Must be text: an object or array here would reach bcrypt and crash.
  body('password').isString().withMessage('Password is required').bail().notEmpty().withMessage('Password is required'),
  validateRequest
], async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const result = await authService.login(req.body.email, req.body.password, { ip: req.ip });
    res.status(200).json({ data: result, message: 'Logged in successfully' });
  } catch (err) {
    if (PADDED_STATUSES.has(err.statusCode)) await padFailure(startedAt);
    next(err);
  }
});

router.get('/me', validateSession, async (req, res) => {
  res.status(200).json({ data: req.user, message: 'OK' });
});

router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await authService.logout(token);
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// Guessing the current password through this endpoint is limited the same
// way as login.
const changePasswordLimiter = createPasswordLoginLimiter({
  message: { error: true, message: 'Too many attempts. Please try again in 15 minutes.', code: 429 },
});

router.patch('/change-password', [
  changePasswordLimiter,
  validateSession,
  body('currentPassword').isString().withMessage('Current password is required').bail().notEmpty().withMessage('Current password is required'),
  // Length, common-password and personal-information rules live in
  // services/passwordPolicy.js, applied by the service.
  body('newPassword').isString().withMessage('New password is required').bail()
    .notEmpty().withMessage('New password is required'),
  validateRequest
], async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword, { ip: req.ip });
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.createPasswordLoginLimiter = createPasswordLoginLimiter;
module.exports.FAILED_LOGIN_MIN_MS = FAILED_LOGIN_MIN_MS;
