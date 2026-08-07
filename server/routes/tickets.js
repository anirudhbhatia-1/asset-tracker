const express = require('express');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { validateSession, requireRole, requirePermission } = require('../middleware/validateSession');
const ticketService = require('../services/ticketService');

const router = express.Router();

router.use(validateSession);

// GET /api/tickets — list support tickets
router.get('/', requirePermission('tickets:read'), async (req, res, next) => {
  try {
    const filters = {
      scope: req.query.scope
    };
    const tickets = await ticketService.getTickets(req.user, filters);
    res.status(200).json({
      data: tickets,
      total: tickets.length,
      message: 'OK'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/:id/history — admin and owner can see
router.get('/:id/history', requirePermission('tickets:read'), async (req, res, next) => {
  try {
    const history = await ticketService.getTicketHistory(req.params.id, req.user);
    res.status(200).json({
      data: history,
      message: 'OK'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets — create a ticket
router.post('/', [
  requirePermission('tickets:create'),
  body('type').isIn(['issue', 'request']).withMessage('Invalid ticket type'),
  body('title').notEmpty().withMessage('Title is required').trim().isLength({ max: 150 }),
  body('description').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('assetId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('categoryId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('targetAdminType').optional({ nullable: true, checkFalsy: true }).isIn(['it', 'hardware', 'hr']).withMessage('Invalid department'),
  validateRequest
], async (req, res, next) => {
  try {
    const ticket = await ticketService.createTicket(req.user, req.body);
    res.status(201).json({
      data: ticket,
      message: 'Ticket created successfully'
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tickets/:id — update a ticket
router.patch('/:id', [
  requirePermission('tickets:update'),
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'rejected']).withMessage('Invalid status'),
  body('resolutionNotes').optional({ nullable: true }).isString().trim(),
  body('resolvedAssetId').optional({ nullable: true }).isInt({ min: 1 }),
  validateRequest
], async (req, res, next) => {
  try {
    const ticket = await ticketService.updateTicket(req.params.id, req.body, req.user);
    res.status(200).json({
      data: ticket,
      message: 'Ticket updated successfully'
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tickets/:id/transfer — transfer ticket to another admin queue
router.patch('/:id/transfer', [
  requirePermission('tickets:resolve'),
  body('targetAdminType').isIn(['it', 'hardware', 'hr']).withMessage('Invalid target admin type'),
  body('note').optional({ nullable: true }).isString().trim(),
  validateRequest
], async (req, res, next) => {
  try {
    const ticket = await ticketService.transferTicket(req.params.id, req.body.targetAdminType, req.body.note, req.user);
    res.status(200).json({
      data: ticket,
      message: 'Ticket transferred successfully'
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tickets/:id/confirm-close — employee confirms a resolved ticket
router.patch('/:id/confirm-close', [
  requirePermission('tickets:read'),
  validateRequest
], async (req, res, next) => {
  try {
    const ticket = await ticketService.confirmTicket(req.params.id, req.user, 'confirm');
    res.status(200).json({
      data: ticket,
      message: 'Ticket closed successfully'
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tickets/:id/reopen — employee reopens a resolved ticket
router.patch('/:id/reopen', [
  requirePermission('tickets:read'),
  body('note').optional({ nullable: true }).isString().trim(),
  validateRequest
], async (req, res, next) => {
  try {
    const ticket = await ticketService.confirmTicket(req.params.id, req.user, 'reopen', req.body.note);
    res.status(200).json({
      data: ticket,
      message: 'Ticket reopened successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
