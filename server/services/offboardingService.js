const { pool, withTransaction } = require('../db');
const assetService = require('./assetService');
const employeeService = require('./employeeService');
const historyService = require('./historyService');
const { hasPermission } = require('../middleware/validateSession');

const OPEN_STATUSES = ['pending', 'in_progress'];
const REASONS = ['resignation', 'termination', 'contract_end', 'retirement', 'other'];

const httpError = (statusCode, message, details) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
};

const mapItem = (row) => ({
  id: row.id,
  assetId: row.asset_id,
  assetName: row.asset_name,
  serialNumber: row.serial_number,
  parentAssetId: row.parent_id || null,
  categoryName: row.category_name || null,
  assetType: row.asset_type || null,
  status: row.status,
  condition: row.condition || null,
  notes: row.notes || null,
  resolvedByName: row.resolved_by_name || null,
  resolvedAt: row.resolved_at || null,
});

const mapRequest = (row) => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: row.employee_name,
  employeeEmail: row.employee_email,
  employeeDepartment: row.employee_department || null,
  employeeHasLogin: Boolean(row.employee_has_login),
  employeeDeleted: Boolean(row.employee_deleted_at),
  lastWorkingDate: row.last_working_date,
  reason: row.reason || null,
  notes: row.notes || null,
  status: row.status,
  revokeAccess: row.revoke_access,
  requestedByName: row.requested_by_name || null,
  completedByName: row.completed_by_name || null,
  completedAt: row.completed_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  totalItems: row.total_items !== undefined ? Number(row.total_items) : undefined,
  pendingItems: row.pending_items !== undefined ? Number(row.pending_items) : undefined,
});

const REQUEST_SELECT = `
  SELECT o.*, e.name AS employee_name, e.email AS employee_email, e.department AS employee_department,
         e.deleted_at AS employee_deleted_at,
         (e.password_hash IS NOT NULL OR e.google_id IS NOT NULL OR e.role IS NOT NULL) AS employee_has_login,
         rb.name AS requested_by_name, cb.name AS completed_by_name,
         -- Open exits count what the employee holds right now, so lists and
         -- notifications stay correct even before the checklist is re-synced.
         CASE WHEN o.status IN ('pending', 'in_progress') THEN
           -- checklist rows already off their hands, plus everything they hold
           (SELECT COUNT(*) FROM offboarding_items i WHERE i.offboarding_request_id = o.id
              AND NOT EXISTS (SELECT 1 FROM assets h WHERE h.id = i.asset_id
                                AND h.assigned_to = o.employee_id AND h.status = 'in-use'))
           + (SELECT COUNT(*) FROM assets a WHERE a.assigned_to = o.employee_id AND a.status = 'in-use')
         ELSE (SELECT COUNT(*) FROM offboarding_items i WHERE i.offboarding_request_id = o.id) END AS total_items,
         CASE WHEN o.status IN ('pending', 'in_progress') THEN
           (SELECT COUNT(*) FROM assets a WHERE a.assigned_to = o.employee_id AND a.status = 'in-use')
         ELSE (SELECT COUNT(*) FROM offboarding_items i WHERE i.offboarding_request_id = o.id AND i.status = 'pending') END AS pending_items
  FROM offboarding_requests o
  JOIN employees e ON e.id = o.employee_id
  LEFT JOIN employees rb ON rb.id = o.requested_by
  LEFT JOIN employees cb ON cb.id = o.completed_by`;

/**
 * Brings an open request's checklist in line with what the employee holds
 * right now: assets assigned since the exit started are added (or reopened),
 * and pending items whose asset left the employee some other way are closed:
 * retired from Inventory counts as missing, anything else as returned.
 */
const syncItems = async (client, request, actorUser = null) => {
  await client.query(`
    INSERT INTO offboarding_items (offboarding_request_id, asset_id, asset_name, serial_number)
    SELECT $1, a.id, a.name, a.serial_number
    FROM assets a
    WHERE a.assigned_to = $2 AND a.status = 'in-use'
    ON CONFLICT (offboarding_request_id, asset_id) DO UPDATE
      SET status = 'pending', condition = NULL, resolved_by = NULL, resolved_at = NULL,
          notes = 'Assigned to the employee again after being checked off'
      WHERE offboarding_items.status <> 'pending'`,
  [request.id, request.employee_id]);

  await client.query(`
    UPDATE offboarding_items i
    SET status = CASE WHEN a.status = 'retired' THEN 'missing' ELSE 'returned' END,
        condition = CASE WHEN a.status = 'retired' THEN NULL ELSE i.condition END,
        resolved_at = NOW(), resolved_by = $3,
        notes = COALESCE(i.notes, CASE
          WHEN a.id IS NULL THEN 'Asset was deleted from Inventory'
          WHEN a.status = 'retired' THEN 'Retired from Inventory outside this checklist'
          ELSE 'Handed back outside this checklist' END)
    FROM offboarding_items i2
    LEFT JOIN assets a ON a.id = i2.asset_id
    WHERE i2.id = i.id AND i.offboarding_request_id = $1 AND i.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM assets held WHERE held.id = i.asset_id AND held.assigned_to = $2 AND held.status = 'in-use'
      )`,
  [request.id, request.employee_id, actorUser?.id || null]);
};

const lockRequest = async (client, id) => {
  const { rows } = await client.query('SELECT * FROM offboarding_requests WHERE id = $1 FOR UPDATE', [id]);
  if (rows.length === 0) throw httpError(404, 'Offboarding request not found');
  return rows[0];
};

// The person leaving can see their exit but never change it.
const assertNotOwnExit = (request, actingUser) => {
  if (actingUser && Number(request.employee_id) === Number(actingUser.id)) {
    throw httpError(403, 'You cannot change your own offboarding');
  }
};

const assertOpen = (request) => {
  if (!OPEN_STATUSES.includes(request.status)) {
    throw httpError(409, `This offboarding is already ${request.status}`);
  }
};

const getRequests = async (filters = {}) => {
  const params = [];
  const conditions = [];
  if (filters.status === 'open') {
    conditions.push(`o.status IN ('pending', 'in_progress')`);
  } else if (filters.status) {
    params.push(filters.status);
    conditions.push(`o.status = $${params.length}`);
  }
  if (filters.employeeId) {
    params.push(filters.employeeId);
    conditions.push(`o.employee_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `${REQUEST_SELECT} ${where}
     ORDER BY (o.status IN ('pending', 'in_progress')) DESC, o.last_working_date ASC, o.id DESC`,
    params
  );
  return rows.map(mapRequest);
};

const getRequestById = async (id) => {
  // Open checklists are reconciled with the live asset state on every read.
  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM offboarding_requests WHERE id = $1 FOR UPDATE', [id]);
    if (rows.length && OPEN_STATUSES.includes(rows[0].status)) await syncItems(client, rows[0]);
  });

  const { rows } = await pool.query(`${REQUEST_SELECT} WHERE o.id = $1`, [id]);
  if (rows.length === 0) return null;
  const { rows: items } = await pool.query(`
    SELECT i.*, a.parent_id, a.asset_type, c.name AS category_name, rb.name AS resolved_by_name
    FROM offboarding_items i
    LEFT JOIN assets a ON a.id = i.asset_id
    LEFT JOIN categories c ON c.id = a.category_id
    LEFT JOIN employees rb ON rb.id = i.resolved_by
    WHERE i.offboarding_request_id = $1
    ORDER BY i.asset_name, i.id`, [id]);
  return { ...mapRequest(rows[0]), items: items.map(mapItem) };
};

const createRequest = async (actingUser, { employeeId, lastWorkingDate, reason, notes, revokeAccess = true }) => {
  if (reason && !REASONS.includes(reason)) throw httpError(400, 'Unknown reason');
  if (Number(employeeId) === Number(actingUser.id)) {
    throw httpError(400, 'You cannot start your own offboarding');
  }

  const id = await withTransaction(async (client) => {
    const { rows: [employee] } = await client.query(
      'SELECT id, name, deleted_at FROM employees WHERE id = $1 FOR UPDATE', [employeeId]
    );
    if (!employee || employee.deleted_at) throw httpError(404, 'Employee not found');

    const { rows: open } = await client.query(
      `SELECT id FROM offboarding_requests WHERE employee_id = $1 AND status IN ('pending', 'in_progress')`,
      [employeeId]
    );
    if (open.length) {
      throw httpError(409, `${employee.name} already has an open offboarding`, { requestId: open[0].id });
    }

    const { rows: [request] } = await client.query(`
      INSERT INTO offboarding_requests (employee_id, last_working_date, reason, notes, revoke_access, requested_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [employeeId, lastWorkingDate, reason || null, notes || null, revokeAccess !== false, actingUser.id]);
    await syncItems(client, request, actingUser);
    return request.id;
  });
  return getRequestById(id);
};

const updateRequest = async (id, { lastWorkingDate, reason, notes, revokeAccess }, actingUser) => {
  if (reason && !REASONS.includes(reason)) throw httpError(400, 'Unknown reason');
  await withTransaction(async (client) => {
    const request = await lockRequest(client, id);
    assertNotOwnExit(request, actingUser);
    assertOpen(request);
    await client.query(`
      UPDATE offboarding_requests
      SET last_working_date = COALESCE($2, last_working_date),
          reason = CASE WHEN $3::boolean THEN $4 ELSE reason END,
          notes = CASE WHEN $5::boolean THEN $6 ELSE notes END,
          revoke_access = COALESCE($7, revoke_access),
          updated_at = NOW()
      WHERE id = $1`,
    [id, lastWorkingDate || null,
      reason !== undefined, reason || null,
      notes !== undefined, notes || null,
      typeof revokeAccess === 'boolean' ? revokeAccess : null]);
  });
  return getRequestById(id);
};

/**
 * Marks one checklist item as returned (asset goes back to stock, or back to
 * its client) or missing (asset is retired with a note). Returning a laptop
 * also returns the accessories attached to it, and their items close with it.
 */
const resolveItem = async (requestId, itemId, { outcome, condition, notes }, actingUser) => {
  if (!['returned', 'missing'].includes(outcome)) throw httpError(400, 'outcome must be returned or missing');
  if (condition && !['good', 'damaged'].includes(condition)) throw httpError(400, 'condition must be good or damaged');
  // Same rights as returning or retiring the asset from Inventory.
  const needed = outcome === 'returned' ? 'assets:assign' : 'assets:delete';
  if (!hasPermission(actingUser, needed)) {
    throw httpError(403, `Marking an asset ${outcome} requires the '${needed}' permission`);
  }

  await withTransaction(async (client) => {
    const request = await lockRequest(client, requestId);
    assertNotOwnExit(request, actingUser);
    assertOpen(request);
    await syncItems(client, request, actingUser);

    const { rows: [item] } = await client.query(
      'SELECT * FROM offboarding_items WHERE id = $1 AND offboarding_request_id = $2 FOR UPDATE',
      [itemId, requestId]
    );
    if (!item) throw httpError(404, 'Item not found in this offboarding');
    if (item.status !== 'pending') throw httpError(409, `${item.asset_name} is already marked ${item.status}`);

    const { rows: [employee] } = await client.query('SELECT name FROM employees WHERE id = $1', [request.employee_id]);
    const detail = [condition === 'damaged' ? 'damaged' : null, notes].filter(Boolean).join(' - ');

    // Under the asset lock, make sure the leaver still holds it: it may have
    // been reassigned since the checklist was synced.
    const asset = await assetService.lockAsset(client, item.asset_id);
    if (asset.status !== 'in-use' || Number(asset.assigned_to) !== Number(request.employee_id)) {
      throw httpError(409, `${item.asset_name} is no longer held by ${employee.name}; reload the checklist`);
    }

    if (outcome === 'returned') {
      await assetService.returnAsset(item.asset_id,
        `Returned at offboarding of ${employee.name}${detail ? ` (${detail})` : ''}`,
        actingUser, { client });
    } else {
      // Only this asset is written off; its accessories stay on the
      // checklist to be handled one by one.
      await client.query(`
        UPDATE assets SET status = 'retired', assigned_to = NULL, assigned_date = NULL, updated_at = NOW()
        WHERE id = $1`, [asset.id]);
      await historyService.logEvent(asset.id, 'retired', actingUser, request.employee_id,
        `Not returned at offboarding of ${employee.name}${notes ? ` (${notes})` : ''}`, null, client);
    }

    await client.query(`
      UPDATE offboarding_items
      SET status = $2, condition = $3, notes = $4, resolved_by = $5, resolved_at = NOW()
      WHERE id = $1`,
    [itemId, outcome, outcome === 'returned' ? (condition || 'good') : null, notes || null, actingUser.id]);

    // Accessories that came back with it.
    if (outcome === 'returned') {
      await client.query(`
        UPDATE offboarding_items i
        SET status = 'returned', condition = 'good', resolved_by = $3, resolved_at = NOW(),
            notes = $4
        FROM assets a
        WHERE i.offboarding_request_id = $1 AND i.status = 'pending' AND a.id = i.asset_id
          AND a.parent_id = $2 AND NOT (a.status = 'in-use' AND a.assigned_to = $5)`,
      [requestId, item.asset_id, actingUser.id, `Returned with ${item.asset_name}`, request.employee_id]);
    }
    await syncItems(client, request, actingUser);
    await client.query(`
      UPDATE offboarding_requests SET status = 'in_progress', updated_at = NOW()
      WHERE id = $1 AND status = 'pending'`, [requestId]);
  });
  return getRequestById(requestId);
};

/**
 * Closes the exit once every asset is accounted for. Optionally revokes the
 * employee's login and removes them from the directory, each subject to the
 * acting user's own permissions.
 */
const completeRequest = async (id, { revokeAccess, deactivateEmployee = false }, actingUser) => {
  if (deactivateEmployee && !hasPermission(actingUser, 'employees:delete')) {
    throw httpError(403, "Removing the employee requires the 'employees:delete' permission");
  }

  // One transaction: if revoking or removing is refused (e.g. the last
  // Director), nothing changes and the exit stays open.
  await withTransaction(async (client) => {
    const request = await lockRequest(client, id);
    assertNotOwnExit(request, actingUser);
    assertOpen(request);
    await syncItems(client, request, actingUser);

    const { rows: pending } = await client.query(
      `SELECT asset_name, serial_number FROM offboarding_items WHERE offboarding_request_id = $1 AND status = 'pending'`,
      [id]
    );
    if (pending.length) {
      throw httpError(409,
        `Mark every asset as returned or missing first. Still open: ${pending.map((i) => i.asset_name).join(', ')}`,
        { pendingItems: pending });
    }

    const shouldRevoke = typeof revokeAccess === 'boolean' ? revokeAccess : request.revoke_access;
    const employee = await employeeService.getEmployeeById(request.employee_id);
    const hasActiveLogin = employee.hasLogin && !employee.deletedAt;
    if (shouldRevoke && hasActiveLogin) {
      if (!hasPermission(actingUser, 'employees:grant-access')) {
        throw httpError(403, "Revoking login access requires the 'employees:grant-access' permission");
      }
      await employeeService.revokeEmployeeAccess(request.employee_id, actingUser, { client });
    }
    if (deactivateEmployee && !employee.deletedAt) {
      await employeeService.deleteEmployee(request.employee_id, actingUser, { client });
    }

    await client.query(`
      UPDATE offboarding_requests
      SET status = 'completed', revoke_access = $2, completed_by = $3, completed_at = NOW(), updated_at = NOW()
      WHERE id = $1`, [id, shouldRevoke && hasActiveLogin, actingUser.id]);
  });
  return getRequestById(id);
};

const cancelRequest = async (id, actingUser) => {
  await withTransaction(async (client) => {
    const request = await lockRequest(client, id);
    assertNotOwnExit(request, actingUser);
    assertOpen(request);
    await client.query(
      `UPDATE offboarding_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]
    );
  });
  return getRequestById(id);
};

module.exports = {
  REASONS,
  getRequests,
  getRequestById,
  createRequest,
  updateRequest,
  resolveItem,
  completeRequest,
  cancelRequest,
};
