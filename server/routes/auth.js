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

router.post('/login', passwordLoginLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validateRequest
], async (req, res, next) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.status(200).json({ data: result, message: 'Logged in successfully' });
  } catch (err) {
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
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long'),
  validateRequest
], async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.createPasswordLoginLimiter = createPasswordLoginLimiter;
