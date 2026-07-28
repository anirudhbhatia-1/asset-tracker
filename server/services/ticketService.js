const db = require('../db');
const assetService = require('./assetService');

const getTickets = async (user, filters = {}) => {
  let query = 'SELECT t.*, c.name as category_name, a.name as asset_name FROM tickets t LEFT JOIN categories c ON t.category_id = c.id LEFT JOIN assets a ON t.asset_id = a.id';
  let params = [];
  let conditions = [];

  if (user.role === 'employee') {
    conditions.push(`t.employee_id = $${params.length + 1}`);
    params.push(user.id);
  } else if ((user.role === 'admin' || user.role === 'hr') && filters.scope !== 'all') {
    if (user.adminType) {
      conditions.push(`t.current_admin_type = $${params.length + 1}`);
      params.push(user.adminType);
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
  if (newStatus === 'resolved' || newStatus === 'rejected') {
    resolvedBy = adminUser.id;
  }

  // Cross-feature synchronization:
  // If the ticket is resolved, and an asset was linked that wasn't linked before, assign it!
  if (newStatus === 'resolved' && newAssetId && newAssetId !== current.resolved_asset_id) {
    await assetService.assignAsset(
      newAssetId, 
      current.employee_id, 
      null, // today
      `Fulfilled via Ticket #${id}`, 
      adminUser.email
    );
  }
  
  const { rows } = await db.pool.query(
    `UPDATE tickets 
     SET status = $1, resolution_notes = $2, resolved_asset_id = $3, resolved_by = $4, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [newStatus, newNotes, newAssetId, resolvedBy, id]
  );
  
  if (newStatus !== current.status) {
    let eventType = 'status_changed';
    if (newStatus === 'resolved') eventType = 'resolved';
    if (newStatus === 'rejected') eventType = 'rejected';

    await db.pool.query(
      `INSERT INTO ticket_history (ticket_id, event_type, performed_by, note) VALUES ($1, $2, $3, $4)`,
      [id, eventType, adminUser.id, newNotes || null]
    );
  }
  
  return rows[0];
};

const getTicketHistory = async (id) => {
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
  
  if (adminUser.adminType !== current.current_admin_type) {
    const err = new Error('You can only transfer tickets that are currently in your queue.');
    err.statusCode = 403;
    throw err;
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

const confirmTicket = async (id, employeeUser, action) => {
  const { rows: currentRows } = await db.pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  if (currentRows.length === 0) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  
  const current = currentRows[0];
  
  if (current.employee_id !== employeeUser.id) {
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
  
  await db.pool.query(
    `INSERT INTO ticket_history (ticket_id, event_type, performed_by, note) 
     VALUES ($1, $2, $3, $4)`,
    [id, eventType, employeeUser.id, action === 'confirm' ? 'Employee confirmed resolution.' : 'Employee reopened ticket.']
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
