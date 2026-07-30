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
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      `UPDATE onboarding_requests 
       SET new_hire_name = $1, new_hire_email = $2, department = $3, 
           location = $4, address = $5, joining_date = $6, notes = $7, updated_at = NOW()
       WHERE id = $8`,
      [newHireName, newHireEmail || null, department || null, location || null, address || null, joiningDate, notes || null, id]
    );

    await client.query(`DELETE FROM onboarding_request_items WHERE onboarding_request_id = $1`, [id]);

    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO onboarding_request_items (onboarding_request_id, category_id, quantity, notes)
           VALUES ($1, $2, $3, $4)`,
          [id, item.categoryId, item.quantity || 1, item.notes || null]
        );
      }
    }

    await client.query('COMMIT');
    return getRequestById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const updateRequestStatus = async (id, status, user) => {
  const { rows } = await db.pool.query(
    `UPDATE onboarding_requests 
     SET status = $1, updated_at = NOW(),
         arranged_by = CASE WHEN $1 = 'arranged' THEN $2 ELSE arranged_by END,
         arranged_at = CASE WHEN $1 = 'arranged' THEN NOW() ELSE arranged_at END
     WHERE id = $3 RETURNING *`,
    [status, user.id, id]
  );
  return rows[0];
};

const fulfillItem = async (requestId, itemId, assetId) => {
  // First, verify the request and see if there is a linked employee
  const req = await getRequestById(requestId);
  if (!req) {
    const err = new Error('Onboarding request not found');
    err.statusCode = 404;
    throw err;
  }

  // Check if item exists and is not already fulfilled with this asset
  const itemRow = req.items.find(i => i.id === itemId);
  if (!itemRow) {
    const err = new Error('Item not found in this request');
    err.statusCode = 404;
    throw err;
  }

  // Cross-feature sync: if it wasn't already fulfilled with this asset and employee exists, assign it!
  if (assetId && req.linked_employee_id && itemRow.fulfilled_asset_id !== assetId) {
    await assetService.assignAsset(
      assetId, 
      req.linked_employee_id, 
      null, 
      `Fulfilled via Onboarding Request #${requestId}`, 
      'Admin System'
    );
  }

  const { rows } = await db.pool.query(
    `UPDATE onboarding_request_items 
     SET fulfilled_asset_id = $1 
     WHERE id = $2 AND onboarding_request_id = $3 RETURNING *`,
    [assetId, itemId, requestId]
  );
  return rows[0];
};

const getHrMetrics = async () => {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM onboarding_requests WHERE status = 'pending') as pending_onboardings,
      (SELECT COUNT(*) FROM onboarding_requests WHERE status = 'arranged' AND date_trunc('month', arranged_at) = date_trunc('month', NOW())) as arranged_this_month,
      (SELECT COUNT(*) FROM assets WHERE status = 'in-use' AND assigned_to IS NOT NULL) as assets_allocated
  `;
  const { rows } = await db.pool.query(query);
  return rows[0];
};

module.exports = {
  getRequests,
  getRequestById,
  createRequest,
  updateRequestDetails,
  updateRequestStatus,
  fulfillItem,
  getHrMetrics
};
