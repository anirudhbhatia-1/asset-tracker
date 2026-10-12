const express = require('express');
const { query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { validateSession, requirePermission } = require('../middleware/validateSession');
const auditService = require('../services/auditService');

const router = express.Router();

router.use(validateSession);

const strictDate = (field) => query(field).optional()
  .isISO8601({ strict: true, strictSeparator: true }).bail()
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .withMessage(`${field} must be a YYYY-MM-DD date`);

// GET /api/audit — the access history, newest first.
// ?eventType=employee. (prefix ending in ".") or an exact type
// &actorId= &targetType=employee|role|system &targetId= &from= &to= (YYYY-MM-DD)
// &q= (actor or target name) &limit= (default 50, max 200) &before= (cursor)
router.get('/', [
  requirePermission('audit:read'),
  (req, res, next) => {
    // Filters take one value each; ?q=a&q=b would reach SQL as an array.
    const repeated = Object.keys(req.query).filter((key) => Array.isArray(req.query[key]));
    if (repeated.length > 0) {
      return res.status(400).json({ error: true, message: `Filter given more than once: ${repeated.join(', ')}`, code: 400 });
    }
    return next();
  },
  // One type or prefix, or a comma-separated list of them.
  query('eventType').optional().isString().bail().isLength({ max: 500 })
    .matches(/^[a-z][a-z_]*(\.[a-z_]*)*(,[a-z][a-z_]*(\.[a-z_]*)*)*$/)
    .withMessage('eventType must look like "employee." or "employee.role_changed,role." (comma-separated)'),
  query('actorId').optional().isInt({ min: 1 }).withMessage('actorId must be a positive integer'),
  query('targetType').optional().isIn(['employee', 'role', 'system']).withMessage('targetType must be employee, role or system'),
  query('targetId').optional().isInt({ min: 1 }).withMessage('targetId must be a positive integer'),
  strictDate('from'),
  strictDate('to'),
  query('q').optional().isString().isLength({ max: 100 }).withMessage('q must be at most 100 characters'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
  query('before').optional().isInt({ min: 1 }).withMessage('before must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    if (req.query.from && req.query.to && req.query.from > req.query.to) {
      return res.status(400).json({ error: true, message: 'from must be on or before to', code: 400 });
    }
    const { data, nextCursor } = await auditService.listEntries({
      eventType: req.query.eventType,
      actorId: req.query.actorId,
      targetType: req.query.targetType,
      targetId: req.query.targetId,
      from: req.query.from,
      to: req.query.to,
      q: req.query.q ? String(req.query.q).trim() : undefined,
      limit: req.query.limit,
      before: req.query.before,
    });
    res.status(200).json({ data, nextCursor, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
