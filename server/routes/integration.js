const crypto = require('crypto');
const express = require('express');
const logger = require('../logger');
const integrationService = require('../services/integrationService');

// Server-to-server access for the Thinkvibes People Portal. Read-only.
//
// Off unless PEOPLE_PORTAL_API_KEY is set (at least 32 characters): without
// it every route here answers 404, as if it did not exist. The portal sends
// the key in the X-Integration-Key header; it is never a user session, so
// nothing here can create, change or delete anything.
const router = express.Router();
const MIN_KEY_LENGTH = 32;

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();

const requireIntegrationKey = (req, res, next) => {
  const expected = process.env.PEOPLE_PORTAL_API_KEY || '';
  if (expected.length < MIN_KEY_LENGTH) {
    return res.status(404).json({ error: true, message: 'Not found', code: 404 });
  }
  const given = req.get('x-integration-key') || '';
  // Compare digests so the check takes the same time whatever was sent.
  if (!given || !crypto.timingSafeEqual(digest(given), digest(expected))) {
    logger.warn({ ip: req.ip, path: req.originalUrl }, 'Integration request with a missing or wrong key');
    return res.status(401).json({ error: true, message: 'Unauthorized', code: 401 });
  }
  next();
};

router.use(requireIntegrationKey);

// GET /api/integration/v1/ping — lets the portal check its settings.
router.get('/v1/ping', (req, res) => {
  res.status(200).json({ data: { ok: true }, message: 'OK' });
});

// GET /api/integration/v1/assignments — every active employee (email, name),
// the assets each one holds right now (accessories nested under their
// laptop) and their bulk items. No costs, no admin notes.
router.get('/v1/assignments', async (req, res, next) => {
  try {
    const data = await integrationService.getAssignmentsSnapshot();
    logger.info({ employees: data.employees.length, assets: data.assets.length }, 'People Portal read the assignments');
    res.status(200).json({ data, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
