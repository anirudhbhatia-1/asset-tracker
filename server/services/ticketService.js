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

// One ticket, with the same visibility as the list: resolvers and Directors
// see any ticket, everyone else only their own. Unknown and hidden tickets
// both return 404 so ticket ids can't be probed.
const getTicketById = async (id, user) => {
  const { rows } = await db.pool.query(`
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
    WHERE t.id = $1
  `, [id]);
  const ticket = rows[0];
  const isDirector = user.role === 'director' || user.isDirector;
  if (!ticket || (!isDirector && !hasPermission(user, 'tickets:resolve') && ticket.employee_id !== user.id)) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  return ticket;
};

// Tickets raised about an asset, or resolved by handing it out, for the
// asset detail timeline.
const getTicketsForAsset = async (assetId) => {
  const { rows } = await db.pool.query(`
    SELECT t.id, t.type, t.title, t.status, t.created_at, t.updated_at,
           t.asset_id, t.resolved_asset_id, t.current_admin_type,
           e.name AS employee_name,
           'TK-' || LPAD(t.id::text, 4, '0') AS human_readable_id
    FROM tickets t
    LEFT JOIN employees e ON t.employee_id = e.id
    WHERE t.asset_id = $1 OR t.resolved_asset_id = $1
    ORDER BY t.created_at DESC
  `, [assetId]);
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

  // A ticket may only be about the requester's own device, unless the
  // requester works tickets themselves.
  if (assetId && !hasPermission(user, 'tickets:resolve')) {
    const { rows: owned } = await db.pool.query(
      'SELECT 1 FROM assets WHERE id = $1 AND assigned_to = $2', [assetId, employeeId]
    );
    if (owned.length === 0) {
      const err = new Error('You can only raise tickets about assets assigned to you');
      err.statusCode = 403;
      throw err;
    }
  }

  const adminTypeToSet = targetAdminType || 'it';

  return db.withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO tickets (type, employee_id, asset_id, category_id, title, description, current_admin_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [type, employeeId, assetId || null, categoryId || null, title, description || null, adminTypeToSet]
    );
    await client.query(
      `INSERT INTO ticket_history (ticket_id, event_type, performed_by) VALUES ($1, 'created', $2)`,
      [rows[0].id, employeeId]
    );
    return rows[0];
  });
};

// ticket_history only records dedicated events for terminal statuses; any
// other transition (e.g. open -> in_progress) is a generic status change.
const STATUS_EVENT_TYPES = { resolved: 'resolved', rejected: 'rejected', closed: 'closed' };
const getStatusEventType = (status) => STATUS_EVENT_TYPES[status] || 'status_changed';

// Status changes allowed through the admin update endpoint. Owners close or
// reopen resolved tickets through confirmTicket; closed is final.
const ALLOWED_STATUS_CHANGES = {
  open: ['in_progress', 'resolved', 'rejected'],
  in_progress: ['open', 'resolved', 'rejected'],
  resolved: ['open', 'in_progress'],
  rejected: ['open'],
  closed: [],
};

const updateTicket = async (id, payload, adminUser) => {
  const { status, resolutionNotes, resolvedAssetId } = payload;

  return db.withTransaction(async (client) => {
    const { rows: currentRows } = await client.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [id]);
    if (currentRows.length === 0) {
      const err = new Error('Ticket not found');
      err.statusCode = 404;
      throw err;
    }
    const current = currentRows[0];
    const newStatus = status || current.status;

    // Same rule as transfers: only the owning queue (or a Director) may work a
    // ticket, and closing it out as resolved/rejected needs tickets:resolve.
    const isDirector = adminUser.role === 'director' || adminUser.isDirector;
    if (!isDirector && (!adminUser.adminType || adminUser.adminType !== current.current_admin_type)) {
      const err = new Error('You can only update tickets that are currently in your queue.');
      err.statusCode = 403;
      throw err;
    }
    if (['resolved', 'rejected'].includes(newStatus) && newStatus !== current.status
        && !hasPermission(adminUser, 'tickets:resolve')) {
      const err = new Error("Resolving or rejecting tickets requires the 'tickets:resolve' permission.");
      err.statusCode = 403;
      throw err;
    }
    if (newStatus !== current.status && !ALLOWED_STATUS_CHANGES[current.status]?.includes(newStatus)) {
      const err = new Error(`A ${current.status.replace('_', ' ')} ticket cannot be moved to ${newStatus.replace('_', ' ')}.`);
      err.statusCode = 400;
      throw err;
    }

    const newNotes = resolutionNotes !== undefined ? resolutionNotes : current.resolution_notes;
    const newAssetId = resolvedAssetId !== undefined ? resolvedAssetId : current.resolved_asset_id;
    const isResolving = newStatus === 'resolved' && current.status !== 'resolved';
    const resolvedBy = isResolving ? adminUser.id : (newStatus === 'resolved' ? current.resolved_by : null);

    // Fulfilling a request hands the chosen asset to the requester, in the
    // same transaction: it must be in stock, and a failure fails the update.
    if (isResolving && newAssetId) {
      const { rows: [asset] } = await client.query('SELECT status, assigned_to FROM assets WHERE id = $1', [newAssetId]);
      const alreadyTheirs = asset && asset.status === 'in-use' && Number(asset.assigned_to) === Number(current.employee_id);
      if (!alreadyTheirs) {
        await assetService.assignAsset(
          newAssetId, current.employee_id, null, `Fulfilled via Ticket #${id}`, adminUser,
          { requireAvailable: true, client }
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE tickets 
       SET status = $1, 
           resolution_notes = $2, 
           resolved_asset_id = $3, 
           resolved_by = $4, 
           updated_at = NOW() 
       WHERE id = $5 RETURNING *`,
      [newStatus, newNotes, newAssetId, resolvedBy, id]
    );

    if (newStatus !== current.status) {
      await client.query(
        `INSERT INTO ticket_history (ticket_id, event_type, performed_by, note) 
         VALUES ($1, $2, $3, $4)`,
        [id, getStatusEventType(newStatus), adminUser.id, newNotes || `Status updated to ${newStatus}`]
      );
    }

    return rows[0];
  });
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
  // One transaction, ticket row locked: status and history change together.
  return db.withTransaction(async (client) => {
    const { rows: currentRows } = await client.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [id]);
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
  
    const { rows } = await client.query(
      `UPDATE tickets SET current_admin_type = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [targetAdminType, id]
    );
  
    await client.query(
      `INSERT INTO ticket_history (ticket_id, event_type, performed_by, from_admin_type, to_admin_type, note) 
       VALUES ($1, 'transferred', $2, $3, $4, $5)`,
      [id, adminUser.id, current.current_admin_type, targetAdminType, note || null]
    );
  
    return rows[0];
  });
};

const confirmTicket = async (id, employeeUser, action, note) => {
  // One transaction, ticket row locked: status and history change together.
  return db.withTransaction(async (client) => {
    const { rows: currentRows } = await client.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [id]);
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
  
    const { rows } = await client.query(
      `UPDATE tickets
         SET status = $1,
             resolved_by = CASE WHEN $1 = 'open' THEN NULL ELSE resolved_by END,
             updated_at = NOW()
         WHERE id = $2 RETURNING *`,
      [newStatus, id]
    );
  
    const historyNote = action === 'confirm' 
      ? 'Employee confirmed resolution.' 
      : (note || 'Employee reopened ticket.');

    await client.query(
      `INSERT INTO ticket_history (ticket_id, event_type, performed_by, note) 
       VALUES ($1, $2, $3, $4)`,
      [id, eventType, employeeUser.id, historyNote]
    );
  
    return rows[0];
  });
};

module.exports = {
  getTicketById,
  getTicketsForAsset,
  getStatusEventType,
  getTickets,
  createTicket,
  updateTicket,
  getTicketHistory,
  transferTicket,
  confirmTicket
};
