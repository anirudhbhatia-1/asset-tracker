const express = require('express');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { validateSession, requireRole } = require('../middleware/validateSession');
const ticketService = require('../services/ticketService');

const router = express.Router();

router.use(validateSession);

// GET /api/tickets — admin sees all, employee sees their own
router.get('/', requireRole('admin', 'employee'), async (req, res, next) => {
  try {
    const tickets = await ticketService.getTickets(req.user);
    res.status(200).json({
      data: tickets,
      total: tickets.length,
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
  requireRole('admin'),
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

module.exports = router;
