const db = require('../db');
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
    status: row.status,
    location: row.location || null,
    costCents: row.cost_cents !== undefined ? Number(row.cost_cents) : 0,
    purchaseDate: row.purchase_date || null,
    notes: row.notes || null,
    assignedTo: row.assigned_to || null,
    assignedDate: row.assigned_date || null,
    assigneeName: row.assignee_name || null,
    assigneeEmail: row.assignee_email || null,
    assigneeDepartment: row.assignee_department || null,
    assigneeAvatarUrl: row.assignee_avatar_url || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const getAssets = (filters = {}) => {
  const conditions = [];
  const params = [];

  if (filters.status && filters.status !== 'all') {
    conditions.push('a.status = ?');
    params.push(filters.status);
  }

  const categoryId = filters.category_id || filters.categoryId;
  if (categoryId && categoryId !== 'all') {
    conditions.push('a.category_id = ?');
    params.push(Number(categoryId));
  }

  if (filters.location && filters.location !== 'all') {
    conditions.push('a.location = ?');
    params.push(filters.location);
  }

  if (filters.q) {
    conditions.push('(a.name LIKE ? OR a.model LIKE ? OR a.serial_number LIKE ?)');
    const likeQuery = `%${filters.q}%`;
    params.push(likeQuery, likeQuery, likeQuery);
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

  const rows = db.prepare(sql).all(...params);
  return rows.map(mapAsset);
};

const getAssetById = (id) => {
  const row = db.prepare(`
    SELECT a.*,
           c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color,
           e.name AS assignee_name, e.email AS assignee_email, e.department AS assignee_department, e.avatar_url AS assignee_avatar_url
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN employees e ON a.assigned_to = e.id
    WHERE a.id = ?
  `).get(id);

  if (!row) {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }

  const asset = mapAsset(row);
  asset.history = historyService.getAssetHistory(id);
  return asset;
};

const getAssetBySerial = (serialNumber) => {
  const row = db.prepare(`
    SELECT a.*,
           c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color,
           e.name AS assignee_name, e.email AS assignee_email, e.department AS assignee_department, e.avatar_url AS assignee_avatar_url
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN employees e ON a.assigned_to = e.id
    WHERE a.serial_number = ?
  `).get(serialNumber);

  if (!row) {
    const err = new Error(`Asset not found for serial number: ${serialNumber}`);
    err.statusCode = 404;
    throw err;
  }

  const asset = mapAsset(row);
  asset.history = historyService.getAssetHistory(asset.id);
  return asset;
};

const createAsset = (data, performedBy = 'Rajan Sharma') => {
  const {
    name, categoryId, model, serialNumber, status = 'available',
    location, costCents = 0, purchaseDate, notes, assignedTo, assignedDate
  } = data;

  // Check unique serial number
  const existing = db.prepare('SELECT id FROM assets WHERE serial_number = ?').get(serialNumber);
  if (existing) {
    const err = new Error('Serial number already exists');
    err.statusCode = 409;
    throw err;
  }

  // Validate status
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
    const emp = db.prepare('SELECT id FROM employees WHERE id = ? AND deleted_at IS NULL').get(assignedTo);
    if (!emp) {
      const err = new Error('Assigned employee not found');
      err.statusCode = 404;
      throw err;
    }
    finalAssignedTo = assignedTo;
    finalAssignedDate = assignedDate || new Date().toISOString().substring(0, 10);
  }

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  let newAssetId;
  const doCreate = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO assets (name, category_id, model, serial_number, status, location, cost_cents, purchase_date, notes, assigned_to, assigned_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, categoryId || null, model || null, serialNumber, status,
      location || null, Number(costCents), purchaseDate || null, notes || null,
      finalAssignedTo, finalAssignedDate, timestamp, timestamp
    );

    newAssetId = result.lastInsertRowid;

    historyService.logEvent(newAssetId, 'created', performedBy, null, `Initial registration: ${name}`, timestamp);

    if (status === 'in-use' && finalAssignedTo) {
      historyService.logEvent(newAssetId, 'assigned', performedBy, finalAssignedTo, 'Assigned upon creation', timestamp);
    }
  });

  doCreate();
  return getAssetById(newAssetId);
};

const updateAsset = (id, data, performedBy = 'Rajan Sharma') => {
  const current = getAssetById(id);

  if (current.status === 'retired') {
    const err = new Error('Retired assets cannot be updated or modified');
    err.statusCode = 400;
    throw err;
  }

  const {
    name, categoryId, model, serialNumber, location, costCents, purchaseDate, notes
  } = data;

  if (serialNumber && serialNumber !== current.serialNumber) {
    const existing = db.prepare('SELECT id FROM assets WHERE serial_number = ? AND id != ?').get(serialNumber, id);
    if (existing) {
      const err = new Error('Serial number already exists');
      err.statusCode = 409;
      throw err;
    }
  }

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const doUpdate = db.transaction(() => {
    db.prepare(`
      UPDATE assets
      SET name = ?,
          category_id = ?,
          model = ?,
          serial_number = ?,
          location = ?,
          cost_cents = ?,
          purchase_date = ?,
          notes = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name : current.name,
      categoryId !== undefined ? (categoryId ? Number(categoryId) : null) : current.categoryId,
      model !== undefined ? model : current.model,
      serialNumber !== undefined ? serialNumber : current.serialNumber,
      location !== undefined ? location : current.location,
      costCents !== undefined ? Number(costCents) : current.costCents,
      purchaseDate !== undefined ? purchaseDate : current.purchaseDate,
      notes !== undefined ? notes : current.notes,
      timestamp,
      id
    );

    historyService.logEvent(id, 'updated', performedBy, current.assignedTo, data.note || 'Asset metadata updated', timestamp);
  });

  doUpdate();
  return getAssetById(id);
};

const deleteAsset = (id, confirm, performedBy = 'Rajan Sharma') => {
  if (confirm !== true && confirm !== 'true') {
    const err = new Error('Destructive actions require confirm: true in request body');
    err.statusCode = 400;
    throw err;
  }

  const current = getAssetById(id);
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const doDelete = db.transaction(() => {
    // Log deleted event first per Rule / Decision 8
    historyService.logEvent(id, 'deleted', performedBy, current.assignedTo, `Permanently deleted asset: ${current.name} (${current.serialNumber})`, timestamp);
    db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  });

  doDelete();
  return { id: Number(id), deleted: true };
};

const assignAsset = (id, employeeId, assignedDate, note, performedBy = 'Rajan Sharma') => {
  const current = getAssetById(id);

  if (current.status === 'retired') {
    const err = new Error('Cannot assign a retired asset');
    err.statusCode = 400;
    throw err;
  }

  const emp = db.prepare('SELECT id, name FROM employees WHERE id = ? AND deleted_at IS NULL').get(employeeId);
  if (!emp) {
    const err = new Error('Assigned employee not found or is deleted');
    err.statusCode = 404;
    throw err;
  }

  const dateToSet = assignedDate || new Date().toISOString().substring(0, 10);
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const doAssign = db.transaction(() => {
    db.prepare(`
      UPDATE assets
      SET status = 'in-use',
          assigned_to = ?,
          assigned_date = ?,
          updated_at = ?
      WHERE id = ?
    `).run(employeeId, dateToSet, timestamp, id);

    historyService.logEvent(id, 'assigned', performedBy, employeeId, note || `Assigned to ${emp.name}`, timestamp);
  });

  doAssign();
  return getAssetById(id);
};

const returnAsset = (id, note, performedBy = 'Rajan Sharma') => {
  const current = getAssetById(id);

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
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const doReturn = db.transaction(() => {
    db.prepare(`
      UPDATE assets
      SET status = 'available',
          assigned_to = NULL,
          assigned_date = NULL,
          updated_at = ?
      WHERE id = ?
    `).run(timestamp, id);

    historyService.logEvent(id, 'returned', performedBy, previousAssignee, note || 'Returned to stock', timestamp);
  });

  doReturn();
  return getAssetById(id);
};

const retireAsset = (id, note, confirm, performedBy = 'Rajan Sharma') => {
  if (confirm !== true && confirm !== 'true') {
    const err = new Error('Destructive actions require confirm: true in request body');
    err.statusCode = 400;
    throw err;
  }

  const current = getAssetById(id);
  const previousAssignee = current.assignedTo;
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const doRetire = db.transaction(() => {
    db.prepare(`
      UPDATE assets
      SET status = 'retired',
          assigned_to = NULL,
          assigned_date = NULL,
          updated_at = ?
      WHERE id = ?
    `).run(timestamp, id);

    historyService.logEvent(id, 'retired', performedBy, previousAssignee, note || 'Asset decommissioned and retired', timestamp);
  });

  doRetire();
  return getAssetById(id);
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
};
