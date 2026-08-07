const db = require('../db');
const assetService = require('./assetService');
const { hasPermission } = require('../middleware/validateSession');

const getTickets = async (user, filters = {}) => {
  let query = `
    SELECT t.*, 
           c.name as category_name, 
           a.name as asset_name,
           e.name as employee_name,
           e.email as employee_email,
           'TK-' || LPAD(t.id::text, 4, '0') as human_readable_id
    FROM tickets t 
    LEFT JOIN categories c ON t.category_id = c.id 
    LEFT JOIN assets a ON t.asset_id = a.id
    LEFT JOIN employees e ON t.employee_id = e.id
  `;
  let params = [];
  let conditions = [];

  const canResolve = hasPermission(user, 'tickets:resolve');
  const isDirector = user.role === 'director' || user.isDirector;

  if (!canResolve && !isDirector) {
    // Non-admin / standard employees only see tickets they created
    conditions.push(`t.employee_id = $${params.length + 1}`);
    params.push(user.id);
  } else {
    // Administrative view (Director, Admin, HR with tickets:resolve permission)
    if (filters.scope === 'all' || isDirector) {
      // Director or explicit scope=all sees everything
    } else if (filters.scope === 'my_tickets') {
      conditions.push(`t.employee_id = $${params.length + 1}`);
      params.push(user.id);
    } else {
      // Default (my_queue): filter by user's admin_type from employees table
      if (user.adminType) {
        conditions.push(`t.current_admin_type = $${params.length + 1}`);
        params.push(user.adminType);
      } else {
        // No admin_type assigned to this admin — they have no queue.
        // Show nothing rather than silently falling through to "all tickets."
        conditions.push('1 = 0');
      }
    }
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY t.created_at DESC';

  const { rows } = await db.pool.query(query, params);
  return rows;
};

const createTicket = async (user, payload) => {
  const { type, title, description, assetId, categoryId, targetAdminType } = payload;
  const employeeId = user.id;

  if (!employeeId) {
    const err = new Error('User is not associated with an employee profile');
    err.statusCode = 400;
    throw err;
  }

  const adminTypeToSet = targetAdminType || 'it';

  const { rows } = await db.pool.query(
    `INSERT INTO tickets (type, employee_id, asset_id, category_id, title, description, current_admin_type) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [type, employeeId, assetId || null, categoryId || null, title, description || null, adminTypeToSet]
  );
  
  const ticket = rows[0];

  await db.pool.query(
    `INSERT INTO ticket_history (ticket_id, event_type, performed_by) VALUES ($1, 'created', $2)`,
    [ticket.id, employeeId]
  );
  
  return ticket;
};

const updateTicket = async (id, payload, adminUser) => {
  const { status, resolutionNotes, resolvedAssetId } = payload;
  
  const { rows: currentRows } = await db.pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  if (currentRows.length === 0) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  
  const current = currentRows[0];
  
  const newStatus = status || current.status;
  const newNotes = resolutionNotes !== undefined ? resolutionNotes : current.resolution_notes;
  const newAssetId = resolvedAssetId !== undefined ? resolvedAssetId : current.resolved_asset_id;
  
  let resolvedBy = current.resolved_by;
  let resolvedAt = current.resolved_at;
  
  if (newStatus === 'resolved' && current.status !== 'resolved') {
    resolvedBy = adminUser.id;
    resolvedAt = new Date().toISOString();
  }
  
  const { rows } = await db.pool.query(
    `UPDATE tickets 
     SET status = $1, 
         resolution_notes = $2, 
         resolved_asset_id = $3, 
         resolved_by = $4, 
         resolved_at = $5,
         updated_at = NOW() 
     WHERE id = $6 RETURNING *`,
    [newStatus, newNotes, newAssetId, resolvedBy, resolvedAt, id]
  );
  
  const updatedTicket = rows[0];

  // Cross-feature synchronization:
  // If the ticket was just resolved and an asset was linked, assign it to the employee in inventory.
  if (newStatus === 'resolved' && current.status !== 'resolved' && newAssetId && newAssetId !== current.resolved_asset_id) {
    try {
      await assetService.assignAsset(
        newAssetId,
        current.employee_id,
        null, // use today
        `Fulfilled via Ticket #${id}`,
        adminUser
      );
    } catch (assignErr) {
      // Don't block the ticket update if asset assignment fails
    }
  }

  if (newStatus !== current.status) {
    await db.pool.query(
      `INSERT INTO ticket_history (ticket_id, event_type, performed_by, note) 
       VALUES ($1, $2, $3, $4)`,
      [id, newStatus, adminUser.id, newNotes || `Status updated to ${newStatus}`]
    );
  }
  
  return updatedTicket;
};

const getTicketHistory = async (id, user) => {
  const { rows: ticketRows } = await db.pool.query('SELECT employee_id FROM tickets WHERE id = $1', [id]);
  if (ticketRows.length === 0) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  const isDirector = user.role === 'director' || user.isDirector;
  const canResolve = hasPermission(user, 'tickets:resolve');

  // Non-admins/non-HR can only view history for tickets they created
  if (!isDirector && !canResolve && ticketRows[0].employee_id !== user.id) {
    const err = new Error('Forbidden - You can only view history for your own tickets');
    err.statusCode = 403;
    throw err;
  }

  const { rows } = await db.pool.query(
    `SELECT th.*, e.name as performed_by_name, e.email as performed_by_email 
     FROM ticket_history th 
     LEFT JOIN employees e ON th.performed_by = e.id 
     WHERE th.ticket_id = $1 
     ORDER BY th.created_at ASC`,
    [id]
  );
  return rows;
};

const transferTicket = async (id, targetAdminType, note, adminUser) => {
  const { rows: currentRows } = await db.pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  if (currentRows.length === 0) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  
  const current = currentRows[0];
  const isDirector = adminUser.role === 'director' || adminUser.isDirector;
  
  // Director can transfer any ticket. Other admins can only transfer from their own queue.
  // If an admin has no adminType assigned, they cannot transfer at all.
  if (!isDirector) {
    if (!adminUser.adminType || adminUser.adminType !== current.current_admin_type) {
      const err = new Error('You can only transfer tickets that are currently in your queue.');
      err.statusCode = 403;
      throw err;
    }
  }

  if (targetAdminType === current.current_admin_type) {
    const err = new Error('Ticket is already in the target queue.');
    err.statusCode = 400;
    throw err;
  }
  
  const { rows } = await db.pool.query(
    `UPDATE tickets SET current_admin_type = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [targetAdminType, id]
  );
  
  await db.pool.query(
    `INSERT INTO ticket_history (ticket_id, event_type, performed_by, from_admin_type, to_admin_type, note) 
     VALUES ($1, 'transferred', $2, $3, $4, $5)`,
    [id, adminUser.id, current.current_admin_type, targetAdminType, note || null]
  );
  
  return rows[0];
};

const confirmTicket = async (id, employeeUser, action, note) => {
  const { rows: currentRows } = await db.pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  if (currentRows.length === 0) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  
  const current = currentRows[0];
  const isDirector = employeeUser.role === 'director' || employeeUser.isDirector;
  
  if (!isDirector && current.employee_id !== employeeUser.id) {
    const err = new Error('You do not have permission to confirm this ticket.');
    err.statusCode = 403;
    throw err;
  }

  if (current.status !== 'resolved') {
    const err = new Error('Only resolved tickets can be confirmed or reopened.');
    err.statusCode = 400;
    throw err;
  }
  
  const newStatus = action === 'confirm' ? 'closed' : 'open';
  const eventType = action === 'confirm' ? 'closed' : 'reopened';
  
  const { rows } = await db.pool.query(
    `UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [newStatus, id]
  );
  
  const historyNote = action === 'confirm' 
    ? 'Employee confirmed resolution.' 
    : (note || 'Employee reopened ticket.');

  await db.pool.query(
    `INSERT INTO ticket_history (ticket_id, event_type, performed_by, note) 
     VALUES ($1, $2, $3, $4)`,
    [id, eventType, employeeUser.id, historyNote]
  );
  
  return rows[0];
};

module.exports = {
  getTickets,
  createTicket,
  updateTicket,
  getTicketHistory,
  transferTicket,
  confirmTicket
};
