const express = require('express');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { validateSession, requireRole } = require('../middleware/validateSession');
const ticketService = require('../services/ticketService');

const router = express.Router();

router.use(validateSession);

// GET /api/tickets — admin sees all, employee sees their own
router.get('/', requireRole('admin', 'employee', 'hr'), async (req, res, next) => {
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
router.get('/:id/history', requireRole('admin', 'employee', 'hr'), async (req, res, next) => {
  try {
    const history = await ticketService.getTicketHistory(req.params.id);
    res.status(200).json({
      data: history,
      message: 'OK'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets — employee creates a ticket
router.post('/', [
  requireRole('employee'),
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

// PATCH /api/tickets/:id — admin updates a ticket
router.patch('/:id', [
  requireRole('admin', 'hr'),
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

// PATCH /api/tickets/:id/transfer — admin transfers ticket to another admin queue
router.patch('/:id/transfer', [
  requireRole('admin', 'hr'),
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

// PATCH /api/tickets/:id/confirm — employee confirms or reopens a resolved ticket
router.patch('/:id/confirm', [
  requireRole('employee'),
  body('action').isIn(['confirm', 'reopen']).withMessage('Invalid action'),
  validateRequest
], async (req, res, next) => {
  try {
    const ticket = await ticketService.confirmTicket(req.params.id, req.user, req.body.action);
    res.status(200).json({
      data: ticket,
      message: 'Ticket confirmation updated successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
