const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const googleService = require('../services/googleService');
const router = express.Router();

const createGoogleLoginLimiter = (overrides = {}) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Successful sign-ins should not consume a shared office/NAT failure budget.
  skipSuccessfulRequests: true,
  message: { error: true, message: 'Too many Google sign-in attempts. Please try again later.', code: 429 },
  ...overrides,
});
const googleLoginLimiter = createGoogleLoginLimiter();
// Original placeholder — kept as-is
router.get('/config', (req, res) => {
  res.status(200).json({ data: { client_id: '', domain: '' }, message: 'Google config route stub' });
});
// POST /api/google/login — Google Identity Services sign-in endpoint
// Accepts a Google ID token (credential) from the frontend Google button.
// Verifies it server-side, looks up the employee, creates a session.
router.post('/login', googleLoginLimiter, [
  body('credential')
    .isString().withMessage('Google credential must be a string')
    .isLength({ min: 1, max: 4096 }).withMessage('Google credential is invalid'),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await googleService.loginWithGoogle(req.body.credential);
    res.status(200).json({ data: result, message: 'Logged in successfully' });
  } catch (err) {
    next(err);
  }
});
module.exports = router;
module.exports.createGoogleLoginLimiter = createGoogleLoginLimiter;
