const db = require('../db');
const assetService = require('./assetService');

const getRequests = async () => {
  const query = `
    SELECT o.*, u.email as requested_by_email, emp.name as linked_employee_name,
      (
        SELECT string_agg(c.name || ' (Qty: ' || i.quantity || ')', ', ')
        FROM onboarding_request_items i
        LEFT JOIN categories c ON i.category_id = c.id
        WHERE i.onboarding_request_id = o.id
      ) as items_summary
    FROM onboarding_requests o 
    LEFT JOIN employees u ON o.requested_by = u.id 
    LEFT JOIN employees emp ON o.linked_employee_id = emp.id 
    ORDER BY o.created_at DESC
  `;
  const { rows } = await db.pool.query(query);
  return rows;
};

const getRequestById = async (id) => {
  const reqQuery = `
    SELECT o.*, u.email as requested_by_email, emp.name as linked_employee_name 
    FROM onboarding_requests o 
    LEFT JOIN employees u ON o.requested_by = u.id 
    LEFT JOIN employees emp ON o.linked_employee_id = emp.id 
    WHERE o.id = $1
  `;
  const itemsQuery = `
    SELECT i.*, c.name as category_name, a.name as fulfilled_asset_name
    FROM onboarding_request_items i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN assets a ON i.fulfilled_asset_id = a.id
    WHERE i.onboarding_request_id = $1
  `;

  const { rows: reqRows } = await db.pool.query(reqQuery, [id]);
  if (reqRows.length === 0) return null;

  const { rows: itemRows } = await db.pool.query(itemsQuery, [id]);
  
  return { ...reqRows[0], items: itemRows };
};

const createRequest = async (user, payload) => {
  const { newHireName, newHireEmail, department, location, address, joiningDate, notes, items } = payload;
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows } = await client.query(
      `INSERT INTO onboarding_requests 
       (requested_by, new_hire_name, new_hire_email, department, location, address, joining_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [user.id, newHireName, newHireEmail || null, department || null, location || null, address || null, joiningDate, notes || null]
    );
    const request = rows[0];

    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO onboarding_request_items (onboarding_request_id, category_id, quantity, notes)
           VALUES ($1, $2, $3, $4)`,
          [request.id, item.categoryId, item.quantity || 1, item.notes || null]
        );
      }
    }

    await client.query('COMMIT');
    return getRequestById(request.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const updateRequestDetails = async (id, payload) => {
  const { newHireName, newHireEmail, department, location, address, joiningDate, notes, items } = payload;

  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE onboarding_requests 
       SET new_hire_name = $1, new_hire_email = $2, department = $3, 
           location = $4, address = $5, joining_date = $6, notes = $7, updated_at = NOW()
       WHERE id = $8`,
      [newHireName, newHireEmail || null, department || null, location || null, address || null, joiningDate, notes || null, id]
    );

    // Items are matched to existing rows by category (the form sends no ids)
    // so fulfilled items keep their assets; omitting `items` leaves them as is.
    if (!Array.isArray(items)) return;
    const { rows: existing } = await client.query(
      'SELECT id, category_id, fulfilled_asset_id FROM onboarding_request_items WHERE onboarding_request_id = $1 ORDER BY id',
      [id]
    );
    const unmatched = [...existing];
    for (const item of items) {
      const index = unmatched.findIndex((row) => Number(row.category_id) === Number(item.categoryId));
      if (index >= 0) {
        const [row] = unmatched.splice(index, 1);
        await client.query(
          'UPDATE onboarding_request_items SET quantity = $1, notes = $2 WHERE id = $3',
          [item.quantity || 1, item.notes || null, row.id]
        );
      } else {
        await client.query(
          `INSERT INTO onboarding_request_items (onboarding_request_id, category_id, quantity, notes)
           VALUES ($1, $2, $3, $4)`,
          [id, item.categoryId, item.quantity || 1, item.notes || null]
        );
      }
    }
    const fulfilledRemovals = unmatched.filter((row) => row.fulfilled_asset_id);
    if (fulfilledRemovals.length > 0) {
      const err = new Error('Items that already have an asset assigned cannot be removed; unassign the asset first.');
      err.statusCode = 409;
      throw err;
    }
    for (const row of unmatched) {
      await client.query('DELETE FROM onboarding_request_items WHERE id = $1', [row.id]);
    }
  });

  return getRequestById(id);
};

// Allowed onboarding status changes; completed is final.
const ALLOWED_REQUEST_STATUS_CHANGES = {
  pending: ['in_progress', 'arranged', 'cancelled'],
  in_progress: ['pending', 'arranged', 'cancelled'],
  arranged: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: ['pending'],
};

const updateRequestStatus = async (id, status, user) => {
  const { rows: [current] } = await db.pool.query('SELECT status FROM onboarding_requests WHERE id = $1', [id]);
  if (!current) {
    const err = new Error('Onboarding request not found');
    err.statusCode = 404;
    throw err;
  }
  if (status !== current.status && !ALLOWED_REQUEST_STATUS_CHANGES[current.status]?.includes(status)) {
    const err = new Error(`A ${current.status.replace('_', ' ')} request cannot be moved to ${status.replace('_', ' ')}.`);
    err.statusCode = 400;
    throw err;
  }
  // Only applies if nobody changed the status since it was checked.
  const { rows } = await db.pool.query(
    `UPDATE onboarding_requests 
     SET status = $1, updated_at = NOW(),
         arranged_by = CASE WHEN $1 = 'arranged' THEN $2 ELSE arranged_by END,
         arranged_at = CASE WHEN $1 = 'arranged' THEN NOW() ELSE arranged_at END
     WHERE id = $3 AND status = $4 RETURNING *`,
    [status, user.id, id, current.status]
  );
  if (rows.length === 0) {
    const err = new Error('This request was changed by someone else; reload and try again.');
    err.statusCode = 409;
    throw err;
  }
  return rows[0];
};

// Links an onboarding request to the new hire's employee record by email.
// Returns the employee id, or null while the new hire has no record yet.
const resolveLinkedEmployee = async (request) => {
  if (request.linked_employee_id) return request.linked_employee_id;
  if (!request.new_hire_email) return null;
  const { rows } = await db.pool.query(
    'SELECT id FROM employees WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1',
    [request.new_hire_email]
  );
  if (rows.length === 0) return null;
  await db.pool.query('UPDATE onboarding_requests SET linked_employee_id = $1, updated_at = NOW() WHERE id = $2',
    [rows[0].id, request.id]);
  return rows[0].id;
};

const fulfillItem = async (requestId, itemId, assetId, actorUser = null) => {
  const req = await getRequestById(requestId);
  if (!req) {
    const err = new Error('Onboarding request not found');
    err.statusCode = 404;
    throw err;
  }
  if (['cancelled', 'completed'].includes(req.status)) {
    const err = new Error(`Items on a ${req.status} request cannot be changed`);
    err.statusCode = 400;
    throw err;
  }
  const itemRow = req.items.find(i => i.id === itemId);
  if (!itemRow) {
    const err = new Error('Item not found in this request');
    err.statusCode = 404;
    throw err;
  }
  if (itemRow.fulfilled_asset_id && itemRow.fulfilled_asset_id !== assetId) {
    const { rows: [previous] } = await db.pool.query('SELECT status FROM assets WHERE id = $1', [itemRow.fulfilled_asset_id]);
    if (previous?.status === 'in-use') {
      const err = new Error('The asset already handed out for this item must be returned before choosing another');
      err.statusCode = 409;
      throw err;
    }
  }

  const linkedEmployeeId = await resolveLinkedEmployee(req);

  return db.withTransaction(async (client) => {
    // Lock the request and item, then re-check what was read above: two people
    // fulfilling the same item at once must not both hand out a device.
    const { rows: [lockedRequest] } = await client.query(
      'SELECT status FROM onboarding_requests WHERE id = $1 FOR UPDATE', [requestId]
    );
    if (!lockedRequest || ['cancelled', 'completed'].includes(lockedRequest.status)) {
      const err = new Error(`Items on a ${lockedRequest?.status || 'removed'} request cannot be changed`);
      err.statusCode = 400;
      throw err;
    }
    const { rows: [lockedItem] } = await client.query(
      'SELECT fulfilled_asset_id FROM onboarding_request_items WHERE id = $1 AND onboarding_request_id = $2 FOR UPDATE',
      [itemId, requestId]
    );
    if (!lockedItem) {
      const err = new Error('Item not found in this request');
      err.statusCode = 404;
      throw err;
    }
    if (Number(lockedItem.fulfilled_asset_id || 0) !== Number(itemRow.fulfilled_asset_id || 0)) {
      const err = new Error('This item was just updated by someone else. Refresh and try again.');
      err.statusCode = 409;
      throw err;
    }

    if (assetId && itemRow.fulfilled_asset_id !== assetId) {
      const { rows: [asset] } = await client.query(
        'SELECT id, name, category_id, status, asset_type FROM assets WHERE id = $1 FOR UPDATE', [assetId]
      );
      if (!asset) {
        const err = new Error('Asset not found');
        err.statusCode = 404;
        throw err;
      }
      if (asset.status !== 'available' || asset.asset_type === 'client') {
        const err = new Error(`${asset.name} is not available company stock`);
        err.statusCode = 409;
        throw err;
      }
      if (itemRow.category_id && Number(asset.category_id) !== Number(itemRow.category_id)) {
        const err = new Error(`${asset.name} is not in the requested category`);
        err.statusCode = 400;
        throw err;
      }
      // A reserved asset stays "available" until the new hire exists, so make
      // sure no other open request has already claimed it.
      const { rows: claimed } = await client.query(
        `SELECT i.onboarding_request_id FROM onboarding_request_items i
         JOIN onboarding_requests r ON r.id = i.onboarding_request_id
         WHERE i.fulfilled_asset_id = $1 AND i.id <> $2 AND r.status NOT IN ('cancelled', 'completed')`,
        [assetId, itemId]
      );
      if (claimed.length > 0) {
        const err = new Error(`${asset.name} is already reserved for onboarding request #${claimed[0].onboarding_request_id}`);
        err.statusCode = 409;
        throw err;
      }

      // Hand it to the new hire now if their employee record exists;
      // otherwise it is assigned when the record is created.
      if (linkedEmployeeId) {
        await assetService.assignAsset(
          assetId, linkedEmployeeId, null, `Fulfilled via Onboarding Request #${requestId}`, actorUser,
          { requireAvailable: true, client }
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE onboarding_request_items 
       SET fulfilled_asset_id = $1 
       WHERE id = $2 AND onboarding_request_id = $3 RETURNING *`,
      [assetId, itemId, requestId]
    );
    return rows[0];
  });
};

const getHrMetrics = async () => {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM onboarding_requests WHERE status = 'pending') as pending_onboardings,
      (SELECT COUNT(*) FROM onboarding_requests WHERE status = 'arranged' AND date_trunc('month', arranged_at) = date_trunc('month', NOW())) as arranged_this_month,
      (SELECT COUNT(*) FROM assets WHERE status = 'in-use' AND assigned_to IS NOT NULL AND asset_type <> 'client') as assets_allocated
  `;
  const { rows } = await db.pool.query(query);
  return rows[0];
};

// Called when an employee record is created: links open onboarding requests
// for that email and assigns any assets already fulfilled on them.
// Called when an employee record is created: links open onboarding requests
// for that email and hands over the assets reserved on them, in one
// transaction. Returns messages about reserved assets that are no longer
// available so the caller can show them instead of failing silently.
const assignFulfilledItemsToEmployee = async (employee, actorUser = null) => {
  const warnings = [];
  await db.withTransaction(async (client) => {
    const { rows: requests } = await client.query(
      `SELECT id FROM onboarding_requests
       WHERE LOWER(new_hire_email) = LOWER($1) AND linked_employee_id IS NULL
         AND status NOT IN ('cancelled', 'completed')
       FOR UPDATE`,
      [employee.email]
    );
    for (const request of requests) {
      await client.query('UPDATE onboarding_requests SET linked_employee_id = $1, updated_at = NOW() WHERE id = $2',
        [employee.id, request.id]);
      const { rows: items } = await client.query(
        `SELECT i.fulfilled_asset_id, a.name, a.status FROM onboarding_request_items i
         JOIN assets a ON a.id = i.fulfilled_asset_id
         WHERE i.onboarding_request_id = $1`,
        [request.id]
      );
      for (const item of items) {
        if (item.status !== 'available') {
          warnings.push(`${item.name} was reserved on onboarding request #${request.id} but is now ${item.status}; choose another asset.`);
          continue;
        }
        await assetService.assignAsset(item.fulfilled_asset_id, employee.id, null,
          `Fulfilled via Onboarding Request #${request.id}`, actorUser, { requireAvailable: true, client });
      }
    }
  });
  return warnings;
};

module.exports = {
  assignFulfilledItemsToEmployee,
  getRequests,
  getRequestById,
  createRequest,
  updateRequestDetails,
  updateRequestStatus,
  fulfillItem,
  getHrMetrics
};
