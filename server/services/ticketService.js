const db = require('../db');
const assetService = require('./assetService');

const getTickets = async (user) => {
  let query = 'SELECT t.*, c.name as category_name, a.name as asset_name FROM tickets t LEFT JOIN categories c ON t.category_id = c.id LEFT JOIN assets a ON t.asset_id = a.id';
  let params = [];

  if (user.role === 'employee') {
    query += ' WHERE t.employee_id = $1';
    params.push(user.employeeId);
  }

  query += ' ORDER BY t.created_at DESC';

  const { rows } = await db.pool.query(query, params);
  return rows;
};

const createTicket = async (user, payload) => {
  const { type, title, description, assetId, categoryId } = payload;
  const employeeId = user.employeeId;

  if (!employeeId) {
    const err = new Error('User is not associated with an employee profile');
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await db.pool.query(
    `INSERT INTO tickets (type, employee_id, asset_id, category_id, title, description) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [type, employeeId, assetId || null, categoryId || null, title, description || null]
  );
  
  return rows[0];
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
  
  return rows[0];
};

module.exports = {
  getTickets,
  createTicket,
  updateTicket
};
