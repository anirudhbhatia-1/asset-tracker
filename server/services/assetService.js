const { pool, withTransaction } = require('../db');
const historyService = require('./historyService');

const mapAsset = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.category_name || null,
    categoryBadgeChar: row.category_badge_char || null,
    categoryColor: row.category_color || null,
    model: row.model || null,
    serialNumber: row.serial_number,
    assetType: row.asset_type || 'company',
    status: row.status,
    location: row.location || null,
    address: row.address || null,
    costCents: row.cost_cents !== undefined ? Number(row.cost_cents) : 0,
    purchaseDate: row.purchase_date || null,
    notes: row.notes || null,
    warrantyExpiryDate: row.warranty_expiry_date || null,
    assignedTo: row.assigned_to || null,
    assignedDate: row.assigned_date || null,
    assigneeName: row.assignee_name || null,
    assigneeEmail: row.assignee_email || null,
    assigneeDepartment: row.assignee_department || null,
    assigneeAvatarUrl: row.assignee_avatar_url || null,
    assignee: row.assigned_to ? {
      id: row.assigned_to,
      name: row.assignee_name || null,
      email: row.assignee_email || null,
      department: row.assignee_department || null,
      avatarUrl: row.assignee_avatar_url || null
    } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    parentId: row.parent_id || null,
    parentAssetName: row.parent_asset_name || null,
    parentSerialNumber: row.parent_serial_number || null,
  };
};

const getAssets = async (filters = {}) => {
  const conditions = [];
  const params = [];

  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`a.status = $${params.length}`);
  }

  const categoryId = filters.category_id || filters.categoryId;
  if (categoryId && categoryId !== 'all') {
    params.push(Number(categoryId));
    conditions.push(`a.category_id = $${params.length}`);
  }

  if (filters.location && filters.location !== 'all') {
    params.push(filters.location);
    conditions.push(`a.location = $${params.length}`);
  }

  if (filters.parentId) {
    params.push(Number(filters.parentId));
    conditions.push(`a.parent_id = $${params.length}`);
  }

  if (filters.q) {
    const likeQuery = `%${filters.q}%`;
    params.push(likeQuery);
    const pos = params.length;
    conditions.push(`(a.name ILIKE $${pos} OR a.model ILIKE $${pos} OR a.serial_number ILIKE $${pos})`);
  }

  if (filters.warranty && filters.warranty !== 'all') {
    if (filters.warranty === 'no-warranty') {
      conditions.push(`a.warranty_expiry_date IS NULL`);
    } else if (filters.warranty === 'expired') {
      conditions.push(`a.warranty_expiry_date < CURRENT_DATE`);
    } else if (filters.warranty === 'expiring-soon') {
      // Within 60 days
      conditions.push(`a.warranty_expiry_date >= CURRENT_DATE AND a.warranty_expiry_date <= CURRENT_DATE + 60`);
    } else if (filters.warranty === 'in-warranty') {
      // More than 60 days
      conditions.push(`a.warranty_expiry_date > CURRENT_DATE + 60`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT a.*,
           c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color,
           e.name AS assignee_name, e.email AS assignee_email, e.department AS assignee_department, e.avatar_url AS assignee_avatar_url
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN employees e ON a.assigned_to = e.id
    ${whereClause}
    ORDER BY a.updated_at DESC, a.id DESC
  `;

  const result = await pool.query(sql, params);
  return result.rows.map(mapAsset);
};

const getAssetById = async (id, client = pool) => {
  const result = await client.query(`
    SELECT a.*,
           c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color,
           e.name AS assignee_name, e.email AS assignee_email, e.department AS assignee_department, e.avatar_url AS assignee_avatar_url,
           parent.name AS parent_asset_name, parent.serial_number AS parent_serial_number
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN employees e ON a.assigned_to = e.id
    LEFT JOIN assets parent ON a.parent_id = parent.id
    WHERE a.id = $1
  `, [id]);

  if (result.rows.length === 0) {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }

  const asset = mapAsset(result.rows[0]);
  asset.history = await historyService.getAssetHistory(id, client);
  return asset;
};

const getAssetBySerial = async (serialNumber) => {
  const result = await pool.query(`
    SELECT a.*,
           c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color,
           e.name AS assignee_name, e.email AS assignee_email, e.department AS assignee_department, e.avatar_url AS assignee_avatar_url,
           parent.name AS parent_asset_name, parent.serial_number AS parent_serial_number
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN employees e ON a.assigned_to = e.id
    LEFT JOIN assets parent ON a.parent_id = parent.id
    WHERE UPPER(a.serial_number) = UPPER($1)
  `, [serialNumber]);

  if (result.rows.length === 0) {
    const err = new Error(`Asset not found for serial number: ${serialNumber}`);
    err.statusCode = 404;
    throw err;
  }

  const asset = mapAsset(result.rows[0]);
  asset.history = await historyService.getAssetHistory(asset.id);
  return asset;
};

const createAsset = async (data, actorUser = null) => {
  const {
    name, categoryId, model, serialNumber, status = 'available', assetType = 'company',
    location, address, costCents = 0, purchaseDate, notes, warrantyExpiryDate, assignedTo, assignedDate,
    parentId, subAssets
  } = data;

  const existing = await pool.query('SELECT id FROM assets WHERE serial_number = $1', [serialNumber]);
  if (existing.rows.length > 0) {
    const err = new Error('Serial number already exists');
    err.statusCode = 409;
    throw err;
  }

  if (!['available', 'in-use', 'retired'].includes(status)) {
    const err = new Error('Invalid status value');
    err.statusCode = 400;
    throw err;
  }

  let finalAssignedTo = null;
  let finalAssignedDate = null;

  if (status === 'in-use') {
    if (!assignedTo) {
      const err = new Error('assignedTo is required when status is in-use');
      err.statusCode = 400;
      throw err;
    }
    const emp = await pool.query('SELECT id FROM employees WHERE id = $1 AND deleted_at IS NULL', [assignedTo]);
    if (emp.rows.length === 0) {
      const err = new Error('Assigned employee not found');
      err.statusCode = 404;
      throw err;
    }
    finalAssignedTo = assignedTo;
    finalAssignedDate = assignedDate || new Date().toISOString().substring(0, 10);
  }

  const newAssetId = await withTransaction(async (client) => {
    const result = await client.query(`
      INSERT INTO assets (name, category_id, model, serial_number, status, asset_type, location, address, cost_cents, purchase_date, notes, warranty_expiry_date, assigned_to, assigned_date, parent_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING id
    `, [
      name, categoryId || null, model || null, serialNumber, status, assetType,
      location || null, address || null, Number(costCents), purchaseDate || null, notes || null,
      warrantyExpiryDate || null, finalAssignedTo, finalAssignedDate, parentId || null
    ]);

    const id = result.rows[0].id;
    await historyService.logEvent(id, 'created', actorUser, null, `Initial registration: ${name}`, null, client);

    if (status === 'in-use' && finalAssignedTo) {
      await historyService.logEvent(id, 'assigned', actorUser, finalAssignedTo, 'Assigned upon creation', null, client);
    }

    if (Array.isArray(subAssets) && subAssets.length > 0) {
      for (const sub of subAssets) {
        if (!sub.serialNumber) continue;
        const subResult = await client.query(`
          INSERT INTO assets (name, category_id, model, serial_number, status, location, address,
                              cost_cents, purchase_date, notes, warranty_expiry_date, parent_id, asset_type, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 'available', $5, $6, 0, NULL, NULL, NULL, $7, 'company', NOW(), NOW())
          RETURNING id
        `, [
          sub.name || `Accessory for ${name}`,
          sub.categoryId ? Number(sub.categoryId) : null,
          sub.model || null,
          sub.serialNumber,
          location || null,
          address || null,
          id,
        ]);
        await historyService.logEvent(
          subResult.rows[0].id,
          'created',
          actorUser,
          null,
          `Sub-asset linked to parent #${id}: ${name}`,
          null,
          client
        );
      }
    }
    
    return id;
  });

  return getAssetById(newAssetId);
};

const updateAsset = async (id, data, actorUser = null) => {
  const current = await getAssetById(id);

  if (current.status === 'retired') {
    const err = new Error('Retired assets cannot be updated or modified');
    err.statusCode = 400;
    throw err;
  }

  const {
    name, categoryId, model, serialNumber, assetType, location, address, costCents, purchaseDate, notes, warrantyExpiryDate
  } = data;

  if (serialNumber && serialNumber !== current.serialNumber) {
    const existing = await pool.query('SELECT id FROM assets WHERE serial_number = $1 AND id != $2', [serialNumber, id]);
    if (existing.rows.length > 0) {
      const err = new Error('Serial number already exists');
      err.statusCode = 409;
      throw err;
    }
  }

  await withTransaction(async (client) => {
    await client.query(`
      UPDATE assets
      SET name = $1,
          category_id = $2,
          model = $3,
          serial_number = $4,
          asset_type = $5,
          location = $6,
          address = $7,
          cost_cents = $8,
          purchase_date = $9,
          notes = $10,
          warranty_expiry_date = $11,
          updated_at = NOW()
      WHERE id = $12
    `, [
      name !== undefined ? name : current.name,
      categoryId !== undefined ? (categoryId ? Number(categoryId) : null) : current.categoryId,
      model !== undefined ? model : current.model,
      serialNumber !== undefined ? serialNumber : current.serialNumber,
      assetType !== undefined ? assetType : current.assetType,
      location !== undefined ? location : current.location,
      address !== undefined ? address : current.address,
      costCents !== undefined ? Number(costCents) : current.costCents,
      purchaseDate !== undefined ? purchaseDate : current.purchaseDate,
      notes !== undefined ? notes : current.notes,
      warrantyExpiryDate !== undefined ? warrantyExpiryDate : current.warrantyExpiryDate,
      id
    ]);

    await historyService.logEvent(id, 'updated', actorUser, current.assignedTo, data.note || 'Asset metadata updated', null, client);
  });

  return getAssetById(id);
};

const deleteAsset = async (id, confirm, actorUser = null) => {
  if (confirm !== true && confirm !== 'true') {
    const err = new Error('Destructive actions require confirm: true in request body');
    err.statusCode = 400;
    throw err;
  }

  const current = await getAssetById(id);

  await withTransaction(async (client) => {
    await historyService.logEvent(id, 'deleted', actorUser, current.assignedTo, `Permanently deleted asset: ${current.name} (${current.serialNumber})`, null, client);
    await client.query('DELETE FROM assets WHERE id = $1', [id]);
  });

  return { id: Number(id), deleted: true };
};

const assignAsset = async (id, employeeId, assignedDate, note, actorUser = null) => {
  const current = await getAssetById(id);

  if (current.status === 'retired') {
    const err = new Error('Cannot assign a retired asset');
    err.statusCode = 400;
    throw err;
  }

  const emp = await pool.query('SELECT id, name FROM employees WHERE id = $1 AND deleted_at IS NULL', [employeeId]);
  if (emp.rows.length === 0) {
    const err = new Error('Assigned employee not found or is deleted');
    err.statusCode = 404;
    throw err;
  }

  const dateToSet = assignedDate || new Date().toISOString().substring(0, 10);

  await withTransaction(async (client) => {
    await client.query(`
      UPDATE assets
      SET status = 'in-use',
          assigned_to = $1,
          assigned_date = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [employeeId, dateToSet, id]);

    await historyService.logEvent(id, 'assigned', actorUser, employeeId, note || `Assigned to ${emp.rows[0].name}`, null, client);

    // CASCADE to sub-assets
    await client.query(
      `UPDATE assets SET status = 'in-use', assigned_to = $1, assigned_date = $2, updated_at = NOW()
       WHERE parent_id = $3 AND status != 'retired'`,
      [employeeId, dateToSet, id]
    );
    const subAssets = await client.query('SELECT id FROM assets WHERE parent_id = $1', [id]);
    for (const sub of subAssets.rows) {
      await historyService.logEvent(sub.id, 'assigned', actorUser, employeeId, `Cascaded from parent asset #${id}`, null, client);
    }
  });

  return getAssetById(id);
};

const returnAsset = async (id, note, actorUser = null) => {
  const current = await getAssetById(id);

  if (current.status === 'retired') {
    const err = new Error('Cannot return a retired asset');
    err.statusCode = 400;
    throw err;
  }

  if (current.status !== 'in-use') {
    const err = new Error('Asset is not currently in use');
    err.statusCode = 400;
    throw err;
  }

  const previousAssignee = current.assignedTo;

  await withTransaction(async (client) => {
    await client.query(`
      UPDATE assets
      SET status = 'available',
          assigned_to = NULL,
          assigned_date = NULL,
          updated_at = NOW()
      WHERE id = $1
    `, [id]);

    await historyService.logEvent(id, 'returned', actorUser, previousAssignee, note || 'Returned to stock', null, client);

    // CASCADE to sub-assets
    await client.query(
      `UPDATE assets SET status = 'available', assigned_to = NULL, assigned_date = NULL, updated_at = NOW()
       WHERE parent_id = $1 AND status = 'in-use'`,
      [id]
    );
    const subAssets = await client.query('SELECT id FROM assets WHERE parent_id = $1', [id]);
    for (const sub of subAssets.rows) {
      await historyService.logEvent(sub.id, 'returned', actorUser, previousAssignee, `Cascaded from parent asset #${id}`, null, client);
    }
  });

  return getAssetById(id);
};

const retireAsset = async (id, note, confirm, actorUser = null) => {
  if (confirm !== true && confirm !== 'true') {
    const err = new Error('Destructive actions require confirm: true in request body');
    err.statusCode = 400;
    throw err;
  }

  const current = await getAssetById(id);
  const previousAssignee = current.assignedTo;

  await withTransaction(async (client) => {
    await client.query(`
      UPDATE assets
      SET status = 'retired',
          assigned_to = NULL,
          assigned_date = NULL,
          updated_at = NOW()
      WHERE id = $1
    `, [id]);

    await historyService.logEvent(id, 'retired', actorUser, previousAssignee, note || 'Asset decommissioned and retired', null, client);
  });

  return getAssetById(id);
};

const bulkAssignAssets = async (employeeId, assetIds, note, actorUser) => {
  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    const err = new Error('assetIds must be a non-empty array');
    err.statusCode = 400;
    throw err;
  }
  // Verify employee exists
  const empCheck = await pool.query('SELECT id, name FROM employees WHERE id = $1 AND deleted_at IS NULL', [employeeId]);
  if (empCheck.rows.length === 0) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    throw err;
  }
  const today = new Date().toISOString().substring(0, 10);
  const assignedNote = note || `Bulk assignment of ${assetIds.length} asset(s)`;
  await withTransaction(async (client) => {
    for (const assetId of assetIds) {
      // Lock the row and verify it is available
      const assetCheck = await client.query(
        'SELECT id, name, status FROM assets WHERE id = $1 FOR UPDATE',
        [assetId]
      );
      if (assetCheck.rows.length === 0) {
        throw Object.assign(new Error(`Asset #${assetId} not found`), { statusCode: 404 });
      }
      if (assetCheck.rows[0].status !== 'available') {
        throw Object.assign(
          new Error(`Asset "${assetCheck.rows[0].name}" is not available (current status: ${assetCheck.rows[0].status})`),
          { statusCode: 409 }
        );
      }
      // Update the asset
      await client.query(
        `UPDATE assets SET status = 'in-use', assigned_to = $1, assigned_date = $2, updated_at = NOW() WHERE id = $3`,
        [employeeId, today, assetId]
      );
      // Log to audit trail using the existing historyService pattern
      await historyService.logEvent(assetId, 'assigned', actorUser, employeeId, assignedNote, null, client);
      // Cascade to any sub-assets (parent-child — Feature 3 prerequisite)
      await client.query(
        `UPDATE assets SET status = 'in-use', assigned_to = $1, assigned_date = $2, updated_at = NOW() WHERE parent_id = $3 AND status = 'available'`,
        [employeeId, today, assetId]
      );
      const subAssets = await client.query('SELECT id FROM assets WHERE parent_id = $1', [assetId]);
      for (const sub of subAssets.rows) {
        await historyService.logEvent(sub.id, 'assigned', actorUser, employeeId, `Cascaded from parent asset #${assetId}`, null, client);
      }
    }
  });
  return { assigned: assetIds.length, employeeId };
};

module.exports = {
  getAssets,
  getAssetById,
  getAssetBySerial,
  createAsset,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  retireAsset,
  bulkAssignAssets,
};
