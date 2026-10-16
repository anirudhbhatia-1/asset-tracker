const { pool, withTransaction } = require('../db');
const { todayISO } = require('../utils/dates');
const { escapeLike } = require('../utils/like');
const historyService = require('./historyService');
const auditService = require('./auditService');

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
    brand:           row.brand || null,
    vendor:          row.vendor || null,
    processor:       row.processor || null,
    ram:             row.ram || null,
    storage:         row.storage || null,
    screenSize:      row.screen_size || null,
    graphicsCard:    row.graphics_card || null,
    os:              row.os || null,
    msOffice:        row.ms_office || null,
    antiVirus:       row.anti_virus || null,
    warrantyPlan:    row.warranty_plan || null,
    warrantyUpgrade: row.warranty_upgrade || null,
    color:           row.color || null,
    hardwareType:    row.hardware_type || null,
    clientName:      row.client_name || null,
    returnDate:      row.return_date || null,
    receivedOn:      row.received_on || null,
  };
};

const serialExists = async (serial) => {
  const { rows } = await pool.query(
    'SELECT 1 FROM assets WHERE LOWER(serial_number) = LOWER($1) LIMIT 1', [serial]
  );
  return rows.length > 0;
};

// Minimal fields for pickers that hand out stock.
const getAvailableCompanyAssets = async (categoryId = null) => {
  const { rows } = await pool.query(`
    SELECT a.id, a.name, a.serial_number, a.category_id, c.name AS category_name
    FROM assets a LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.status = 'available' AND a.asset_type = 'company'
      AND ($1::int IS NULL OR a.category_id = $1)
    ORDER BY a.name, a.serial_number
  `, [categoryId]);
  return rows.map((row) => ({
    id: row.id, name: row.name, serialNumber: row.serial_number,
    categoryId: row.category_id, categoryName: row.category_name,
  }));
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

  // Client-owned assets are tracked but kept out of company inventory views.
  if (filters.assetType === 'company' || filters.assetType === 'client') {
    params.push(filters.assetType);
    conditions.push(`a.asset_type = $${params.length}`);
  }

  if (filters.parentId) {
    params.push(Number(filters.parentId));
    conditions.push(`a.parent_id = $${params.length}`);
  }

  if (filters.q) {
    // Typed % and _ are searched for literally, not as wildcards.
    const likeQuery = `%${escapeLike(String(filters.q))}%`;
    params.push(likeQuery);
    const pos = params.length;
    conditions.push(`(a.name ILIKE $${pos} OR a.model ILIKE $${pos} OR a.serial_number ILIKE $${pos})`);
  }

  if (filters.warranty && filters.warranty !== 'all') {
    if (filters.warranty === 'no-warranty') {
      conditions.push(`a.warranty_expiry_date IS NULL`);
    } else if (filters.warranty === 'expired') {
      params.push(todayISO());
      conditions.push(`a.warranty_expiry_date < $${params.length}::date`);
    } else if (filters.warranty === 'expiring-soon') {
      // Within 60 days of today in the company's time zone (not the DB's),
      // and not retired assets — the same rule as the dashboard's warranty card.
      params.push(todayISO());
      conditions.push(`a.warranty_expiry_date >= $${params.length}::date AND a.warranty_expiry_date <= $${params.length}::date + 60 AND a.status <> 'retired'`);
    } else if (filters.warranty === 'in-warranty') {
      // More than 60 days
      params.push(todayISO());
      conditions.push(`a.warranty_expiry_date > $${params.length}::date + 60`);
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

// options.withHistory — also load the full history (the scanner doesn't show it).
const getAssetBySerial = async (serialNumber, { withHistory = false } = {}) => {
  const result = await pool.query(`
    SELECT a.*,
           c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color,
           e.name AS assignee_name, e.email AS assignee_email, e.department AS assignee_department, e.avatar_url AS assignee_avatar_url,
           parent.name AS parent_asset_name, parent.serial_number AS parent_serial_number
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN employees e ON a.assigned_to = e.id
    LEFT JOIN assets parent ON a.parent_id = parent.id
    WHERE LOWER(a.serial_number) = LOWER($1)
  `, [serialNumber]);

  if (result.rows.length === 0) {
    const err = new Error('No asset with this serial number');
    err.statusCode = 404;
    throw err;
  }

  const asset = mapAsset(result.rows[0]);
  if (withHistory) asset.history = await historyService.getAssetHistory(asset.id);
  return asset;
};

const createAsset = async (data, actorUser = null) => {
  const {
    name, categoryId, model, serialNumber, status = 'available', assetType = 'company',
    location, address, costCents = 0, purchaseDate, notes, warrantyExpiryDate, assignedTo, assignedDate,
    parentId, subAssets,
    // NEW FIELDS:
    brand, vendor, processor, ram, storage, screenSize, graphicsCard,
    os, msOffice, antiVirus, warrantyPlan, warrantyUpgrade,
    color, hardwareType, clientName, returnDate, receivedOn,
  } = data;

  const existing = await pool.query('SELECT id FROM assets WHERE LOWER(serial_number) = LOWER($1)', [serialNumber]);
  if (existing.rows.length > 0) {
    const err = new Error('Serial number already exists');
    err.statusCode = 409;
    throw err;
  }

  if (!['available', 'in-use', 'retired', 'returned'].includes(status)) {
    const err = new Error('Invalid status value');
    err.statusCode = 400;
    throw err;
  }

  if (status === 'retired' && assetType === 'client') {
    const err = new Error('A client-owned asset cannot be added as retired');
    err.statusCode = 400;
    throw err;
  }
  if (status === 'returned' && assetType !== 'client') {
    const err = new Error('Only client-owned assets can be marked returned to client');
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
    finalAssignedDate = assignedDate || todayISO();
  }

  const newAssetId = await withTransaction(async (client) => {
    const result = await client.query(`
      INSERT INTO assets (
        name, category_id, model, serial_number, status, asset_type,
        location, address, cost_cents, purchase_date, notes, warranty_expiry_date,
        assigned_to, assigned_date, parent_id,
        brand, vendor, processor, ram, storage, screen_size, graphics_card,
        os, ms_office, anti_virus, warranty_plan, warranty_upgrade,
        color, hardware_type, client_name, return_date, received_on,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
              $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,
              $28,$29,$30,$31,$32,NOW(),NOW())
      RETURNING id
    `, [
      name, categoryId || null, model || null, serialNumber, status, assetType,
      location || null, address || null, Number(costCents), purchaseDate || null,
      notes || null, warrantyExpiryDate || null, finalAssignedTo, finalAssignedDate,
      parentId || null,
      brand || null, vendor || null, processor || null, ram || null,
      storage || null, screenSize || null, graphicsCard || null,
      os || null, msOffice || null, antiVirus || null, warrantyPlan || null,
      warrantyUpgrade || null, color || null, hardwareType || null,
      clientName || null, returnDate || null, receivedOn || null,
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
    name, categoryId, model, serialNumber, assetType, location, address, costCents, purchaseDate, notes, warrantyExpiryDate,
    brand, vendor, processor, ram, storage, screenSize, graphicsCard,
    os, msOffice, antiVirus, warrantyPlan, warrantyUpgrade,
    color, hardwareType, clientName, returnDate, receivedOn
  } = data;

  if (current.assetType === 'client' && assetType !== undefined && assetType !== 'client') {
    // Switching it to company-owned would let it be retired or deleted.
    const err = new Error('A client-owned asset cannot be changed to company-owned');
    err.statusCode = 400;
    throw err;
  }

  if (serialNumber && serialNumber !== current.serialNumber) {
    const existing = await pool.query('SELECT id FROM assets WHERE LOWER(serial_number) = LOWER($1) AND id != $2', [serialNumber, id]);
    if (existing.rows.length > 0) {
      const err = new Error('Serial number already exists');
      err.statusCode = 409;
      throw err;
    }
  }

  await withTransaction(async (client) => {
    // Re-read under a row lock so concurrent edits of different fields don't
    // overwrite each other with stale values.
    const { rows: [lockedRow] } = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [id]);
    const fresh = mapAsset(lockedRow);
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
          brand = $12,
          vendor = $13,
          processor = $14,
          ram = $15,
          storage = $16,
          screen_size = $17,
          graphics_card = $18,
          os = $19,
          ms_office = $20,
          anti_virus = $21,
          warranty_plan = $22,
          warranty_upgrade = $23,
          color = $24,
          hardware_type = $25,
          client_name = $26,
          return_date = $27,
          received_on = $28,
          updated_at = NOW()
      WHERE id = $29
    `, [
      name !== undefined ? name : fresh.name,
      categoryId !== undefined ? (categoryId ? Number(categoryId) : null) : fresh.categoryId,
      model !== undefined ? model : fresh.model,
      serialNumber !== undefined ? serialNumber : fresh.serialNumber,
      assetType !== undefined ? assetType : fresh.assetType,
      location !== undefined ? location : fresh.location,
      address !== undefined ? address : fresh.address,
      costCents !== undefined ? (costCents === null ? null : Number(costCents)) : fresh.costCents,
      purchaseDate !== undefined ? purchaseDate : fresh.purchaseDate,
      notes !== undefined ? notes : fresh.notes,
      warrantyExpiryDate !== undefined ? warrantyExpiryDate : fresh.warrantyExpiryDate,
      brand !== undefined ? brand : fresh.brand,
      vendor !== undefined ? vendor : fresh.vendor,
      processor !== undefined ? processor : fresh.processor,
      ram !== undefined ? ram : fresh.ram,
      storage !== undefined ? storage : fresh.storage,
      screenSize !== undefined ? screenSize : fresh.screenSize,
      graphicsCard !== undefined ? graphicsCard : fresh.graphicsCard,
      os !== undefined ? os : fresh.os,
      msOffice !== undefined ? msOffice : fresh.msOffice,
      antiVirus !== undefined ? antiVirus : fresh.antiVirus,
      warrantyPlan !== undefined ? warrantyPlan : fresh.warrantyPlan,
      warrantyUpgrade !== undefined ? warrantyUpgrade : fresh.warrantyUpgrade,
      color !== undefined ? color : fresh.color,
      hardwareType !== undefined ? hardwareType : fresh.hardwareType,
      clientName !== undefined ? clientName : fresh.clientName,
      returnDate !== undefined ? returnDate : fresh.returnDate,
      receivedOn !== undefined ? receivedOn : fresh.receivedOn,
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
    // Someone is using it: return it first so the hand-back is on record.
    const locked = await lockAsset(client, id);
    if (locked.asset_type === 'client') throw clientAssetError(locked.name, 'deleted');
    if (locked.status === 'in-use') {
      const err = new Error('Return this asset before deleting it');
      err.statusCode = 409;
      throw err;
    }
    await historyService.logEvent(id, 'deleted', actorUser, current.assignedTo, `Permanently deleted asset: ${current.name} (${current.serialNumber})`, null, client);
    // Destructive: also goes in the access history, where asset history
    // alone would vanish with the asset's page.
    await auditService.record(client, {
      eventType: 'asset.deleted',
      actor: actorUser,
      targetType: 'system',
      targetName: `${current.name} (${current.serialNumber})`,
      details: { assetId: Number(id), serialNumber: current.serialNumber, status: current.status, assetType: current.assetType },
    });
    await client.query('DELETE FROM assets WHERE id = $1', [id]);
  });

  return { id: Number(id), deleted: true };
};

// Runs `fn` in the caller's transaction when one is supplied, otherwise in a
// new one, so ticket/onboarding flows can assign atomically with their own
// updates.
const inTransaction = (client, fn) => (client ? fn(client) : withTransaction(fn));

// Client-owned assets belong to the client: they can only be assigned and
// then returned to the client. Retiring, reassigning or deleting one is never
// allowed, for any role.
const CLIENT_ASSET_RULE = 'is client-owned: it can only be assigned and returned to the client';
const clientAssetError = (name, action) => Object.assign(
  new Error(`${name} ${CLIENT_ASSET_RULE}, not ${action}.`),
  { statusCode: 409, reason: 'CLIENT_ASSET_LOCKED' }
);

const lockAsset = async (client, id) => {
  const { rows } = await client.query(
    'SELECT id, name, status, assigned_to, asset_type FROM assets WHERE id = $1 FOR UPDATE',
    [id]
  );
  if (rows.length === 0) {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
};

// Locks the given assets AND their accessories in one fixed order (by id)
// before any of them is changed. Every single and bulk assign/return/retire
// takes its locks this way, so two of them running at once can never wait on
// each other in a loop (which Postgres would abort as a deadlock).
const lockAssetsWithAccessories = (client, ids) => client.query(
  'SELECT id FROM assets WHERE id = ANY($1::int[]) OR parent_id = ANY($1::int[]) ORDER BY id FOR UPDATE',
  [ids.map(Number)]
);

/**
 * Assigns an asset (and its accessories) to an employee.
 * options.reassign     — allow taking it from its current holder (explicit
 *                        "Reassign" in the asset UI); otherwise an in-use
 *                        asset is refused.
 * options.requireAvailable — only accept assets in stock (ticket/onboarding
 *                        fulfilment must never take someone else's device).
 * options.client       — run inside the caller's transaction (returns null).
 */
const assignAsset = async (id, employeeId, assignedDate, note, actorUser = null, options = {}) => {
  const { reassign = false, requireAvailable = false, client: outerClient = null } = options;
  const dateToSet = assignedDate || todayISO();

  await inTransaction(outerClient, async (client) => {
    await lockAssetsWithAccessories(client, [id]);
    const current = await lockAsset(client, id);

    if (current.status === 'retired') {
      const err = new Error('Cannot assign a retired asset');
      err.statusCode = 400;
      throw err;
    }
    if (current.asset_type === 'client' && current.status === 'returned') {
      // Already handed back: the device is with the client, not in our stock.
      throw Object.assign(
        new Error(`${current.name} has been returned to the client and can't be assigned again.`),
        { statusCode: 409, reason: 'CLIENT_ASSET_LOCKED' }
      );
    }
    if (requireAvailable && current.status !== 'available') {
      const err = new Error(`${current.name} is not available (status: ${current.status})`);
      err.statusCode = 409;
      throw err;
    }

    const emp = await client.query('SELECT id, name FROM employees WHERE id = $1 AND deleted_at IS NULL', [employeeId]);
    if (emp.rows.length === 0) {
      const err = new Error('Assigned employee not found or is deleted');
      err.statusCode = 404;
      throw err;
    }

    const previousHolder = current.status === 'in-use' ? current.assigned_to : null;
    if (previousHolder && Number(previousHolder) === Number(employeeId)) {
      const err = new Error('Asset is already assigned to this employee');
      err.statusCode = 400;
      throw err;
    }
    if (previousHolder && current.asset_type === 'client') {
      // Must go back first (to the client), never straight to someone else.
      throw clientAssetError(current.name, 'reassigned');
    }
    if (previousHolder && !reassign) {
      const err = new Error(`${current.name} is currently assigned to someone else`);
      err.statusCode = 409;
      throw err;
    }

    // Reassigning straight from one person to another: record the hand-back
    // first so the audit trail shows who held it before.
    if (previousHolder) {
      await historyService.logEvent(id, 'returned', actorUser, previousHolder,
        `Reassigned to ${emp.rows[0].name}`, null, client);
    }

    await client.query(`
      UPDATE assets
      SET status = 'in-use',
          assigned_to = $1,
          assigned_date = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [employeeId, dateToSet, id]);

    await historyService.logEvent(id, 'assigned', actorUser, employeeId, note || `Assigned to ${emp.rows[0].name}`, null, client);

    // Accessories follow, but only those in stock or held by the same
    // previous holder — never ones someone else is using.
    const { rows: moved } = await client.query(
      `UPDATE assets SET status = 'in-use', assigned_to = $1, assigned_date = $2, updated_at = NOW()
       WHERE parent_id = $3
         AND (status = 'available' OR (status = 'in-use' AND assigned_to IS NOT DISTINCT FROM $4))
       RETURNING id`,
      [employeeId, dateToSet, id, previousHolder]
    );
    for (const sub of moved) {
      await historyService.logEvent(sub.id, 'assigned', actorUser, employeeId, `Cascaded from parent asset #${id}`, null, client);
    }
  });

  return outerClient ? null : getAssetById(id);
};

// options.client — run inside the caller's transaction (returns null).
const returnAsset = async (id, note, actorUser = null, options = {}) => {
  const { client: outerClient = null } = options;
  await inTransaction(outerClient, async (client) => {
    await lockAssetsWithAccessories(client, [id]);
    const current = await lockAsset(client, id);

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

    const previousAssignee = current.assigned_to;
    // A client-owned asset goes back to the client, not into company stock.
    const isClientAsset = current.asset_type === 'client';

    await client.query(`
      UPDATE assets
      SET status = $2,
          assigned_to = NULL,
          assigned_date = NULL,
          updated_at = NOW()
      WHERE id = $1
    `, [id, isClientAsset ? 'returned' : 'available']);

    await historyService.logEvent(id, 'returned', actorUser, previousAssignee,
      note || (isClientAsset ? 'Returned to client' : 'Returned to stock'), null, client);

    // Accessories held by the same person come back too, each by its own ownership.
    const { rows: released } = await client.query(
      `UPDATE assets
       SET status = CASE WHEN asset_type = 'client' THEN 'returned' ELSE 'available' END,
           assigned_to = NULL, assigned_date = NULL, updated_at = NOW()
       WHERE parent_id = $1 AND status = 'in-use' AND assigned_to = $2
       RETURNING id`,
      [id, previousAssignee]
    );
    for (const sub of released) {
      await historyService.logEvent(sub.id, 'returned', actorUser, previousAssignee, `Cascaded from parent asset #${id}`, null, client);
    }
  });

  return outerClient ? null : getAssetById(id);
};

const retireAsset = async (id, note, confirm, actorUser = null) => {
  if (confirm !== true && confirm !== 'true') {
    const err = new Error('Destructive actions require confirm: true in request body');
    err.statusCode = 400;
    throw err;
  }

  await withTransaction(async (client) => {
    await lockAssetsWithAccessories(client, [id]);
    const current = await lockAsset(client, id);
    if (current.asset_type === 'client') throw clientAssetError(current.name, 'retired');
    if (current.status === 'retired') {
      const err = new Error('Asset is already retired');
      err.statusCode = 400;
      throw err;
    }
    const previousAssignee = current.status === 'in-use' ? current.assigned_to : null;

    await client.query(`
      UPDATE assets
      SET status = 'retired',
          assigned_to = NULL,
          assigned_date = NULL,
          updated_at = NOW()
      WHERE id = $1
    `, [id]);

    await historyService.logEvent(id, 'retired', actorUser, previousAssignee, note || 'Asset decommissioned and retired', null, client);

    // Accessories (e.g. adaptors) are not retired with their laptop; release
    // any still held by the old assignee back to stock (or to their client).
    const { rows: released } = await client.query(
      `UPDATE assets
       SET status = CASE WHEN asset_type = 'client' THEN 'returned' ELSE 'available' END,
           assigned_to = NULL, assigned_date = NULL, updated_at = NOW()
       WHERE parent_id = $1 AND status = 'in-use' AND assigned_to = $2
       RETURNING id`,
      [id, previousAssignee]
    );
    for (const sub of released) {
      await historyService.logEvent(sub.id, 'returned', actorUser, previousAssignee,
        `Released because parent asset #${id} was retired`, null, client);
    }
  });

  return getAssetById(id);
};

// options.companyOnly — refuse client-owned assets (Inventory bulk actions
// hand out company stock only).
const bulkAssignAssets = async (employeeId, assetIds, note, actorUser, options = {}) => {
  const { companyOnly = false } = options;
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
  const today = todayISO();
  const assignedNote = note || `Bulk assignment of ${assetIds.length} asset(s)`;
  // Lock in a fixed order so two overlapping bulk assignments can't deadlock.
  const orderedIds = [...new Set(assetIds.map(Number))].sort((a, b) => a - b);
  // Accessories already carried along with their parent earlier in this batch
  // (e.g. a laptop and its charger both selected) are assigned, not "busy".
  const cascaded = new Set();
  await withTransaction(async (client) => {
    await lockAssetsWithAccessories(client, orderedIds);
    if (companyOnly) {
      // Checked for every selected asset up front (an accessory selected with
      // its parent is otherwise skipped below and never checked).
      const { rows: clientOwned } = await client.query(
        "SELECT name FROM assets WHERE id = ANY($1::int[]) AND asset_type = 'client' ORDER BY id LIMIT 1",
        [orderedIds]
      );
      if (clientOwned.length) {
        throw Object.assign(
          new Error(`Asset "${clientOwned[0].name}" is client-owned and can't be assigned from company stock`),
          { statusCode: 409 }
        );
      }
    }
    for (const assetId of orderedIds) {
      if (cascaded.has(assetId)) continue;
      // Lock the row and verify it is available
      const assetCheck = await client.query(
        'SELECT id, name, status, asset_type FROM assets WHERE id = $1 FOR UPDATE',
        [assetId]
      );
      if (assetCheck.rows.length === 0) {
        throw Object.assign(new Error(`Asset #${assetId} not found`), { statusCode: 404 });
      }
      if (companyOnly && assetCheck.rows[0].asset_type === 'client') {
        throw Object.assign(
          new Error(`Asset "${assetCheck.rows[0].name}" is client-owned and can't be assigned from company stock`),
          { statusCode: 409 }
        );
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
      const { rows: moved } = await client.query(
        `UPDATE assets SET status = 'in-use', assigned_to = $1, assigned_date = $2, updated_at = NOW()
         WHERE parent_id = $3 AND status = 'available'
           AND ($4::boolean IS NOT TRUE OR asset_type = 'company') RETURNING id`,
        [employeeId, today, assetId, companyOnly]
      );
      for (const sub of moved) {
        cascaded.add(Number(sub.id));
        await historyService.logEvent(sub.id, 'assigned', actorUser, employeeId, `Cascaded from parent asset #${assetId}`, null, client);
      }
    }
  });
  return { assigned: orderedIds.length, employeeId };
};

/**
 * Returns every in-use asset in `assetIds` in one transaction (client-owned
 * ones go back to their client, accessories follow as in returnAsset).
 * Anything not in use is skipped rather than failing the batch.
 */
const bulkReturnAssets = async (assetIds, note, actorUser) => {
  const orderedIds = [...new Set(assetIds.map(Number))].sort((a, b) => a - b);
  const returnedIds = new Set();
  const skipped = [];
  await withTransaction(async (client) => {
    await lockAssetsWithAccessories(client, orderedIds);
    for (const assetId of orderedIds) {
      // Already brought back as an accessory of another asset in this batch.
      if (returnedIds.has(assetId)) continue;
      const { rows: [current] } = await client.query(
        'SELECT id, name, status, assigned_to FROM assets WHERE id = $1 FOR UPDATE', [assetId]
      );
      if (!current) {
        skipped.push({ id: assetId, name: null, reason: 'Asset not found' });
        continue;
      }
      if (current.status !== 'in-use') {
        skipped.push({ id: assetId, name: current.name, reason: `Not in use (status: ${current.status})` });
        continue;
      }
      const { rows: accessories } = await client.query(
        "SELECT id FROM assets WHERE parent_id = $1 AND status = 'in-use' AND assigned_to = $2",
        [assetId, current.assigned_to]
      );
      await returnAsset(assetId, note || undefined, actorUser, { client });
      returnedIds.add(assetId);
      for (const sub of accessories) returnedIds.add(sub.id);
    }
  });
  // Accessories returned with their parent count only if they were selected.
  const returned = orderedIds.filter((id) => returnedIds.has(id)).length;
  // An accessory skipped before its parent was processed did come back after all.
  return { returned, skipped: skipped.filter((s) => !returnedIds.has(s.id)) };
};

/**
 * Applies the same location and/or category to many assets in one
 * transaction, with an 'updated' history entry per asset. All or nothing:
 * unknown or retired assets fail the whole batch.
 */
const bulkUpdateAssets = async (assetIds, changes, actorUser) => {
  const hasLocation = Object.prototype.hasOwnProperty.call(changes, 'location');
  const hasCategory = Object.prototype.hasOwnProperty.call(changes, 'categoryId');
  if (!hasLocation && !hasCategory) {
    throw Object.assign(new Error('Choose at least one change'), { statusCode: 400 });
  }
  const location = hasLocation ? (changes.location ? String(changes.location).trim() || null : null) : undefined;
  const categoryId = hasCategory ? (changes.categoryId == null ? null : Number(changes.categoryId)) : undefined;

  let categoryName = null;
  if (hasCategory && categoryId !== null) {
    const { rows } = await pool.query('SELECT name FROM categories WHERE id = $1', [categoryId]);
    if (rows.length === 0) throw Object.assign(new Error('Category not found'), { statusCode: 400 });
    categoryName = rows[0].name;
  }

  const orderedIds = [...new Set(assetIds.map(Number))].sort((a, b) => a - b);
  await withTransaction(async (client) => {
    const { rows } = await client.query(`
      SELECT a.id, a.name, a.status, a.location, a.category_id, a.assigned_to, c.name AS category_name
      FROM assets a LEFT JOIN categories c ON c.id = a.category_id
      WHERE a.id = ANY($1::int[])
      ORDER BY a.id
      FOR UPDATE OF a
    `, [orderedIds]);
    const found = new Map(rows.map((row) => [row.id, row]));
    const missing = orderedIds.find((id) => !found.has(id));
    if (missing) throw Object.assign(new Error(`Asset #${missing} not found`), { statusCode: 404 });
    const retired = rows.find((row) => row.status === 'retired');
    if (retired) {
      throw Object.assign(new Error(`"${retired.name}" is retired; retired assets cannot be changed`), { statusCode: 400 });
    }

    await client.query(`
      UPDATE assets
      SET location = CASE WHEN $2::boolean THEN $3::text ELSE location END,
          category_id = CASE WHEN $4::boolean THEN $5::int ELSE category_id END,
          updated_at = NOW()
      WHERE id = ANY($1::int[])
    `, [orderedIds, hasLocation, location ?? null, hasCategory, categoryId ?? null]);

    for (const row of rows) {
      const parts = [];
      if (hasLocation) parts.push(`location: ${row.location || 'none'} → ${location || 'none'}`);
      if (hasCategory) parts.push(`category: ${row.category_name || 'none'} → ${categoryName || 'none'}`);
      await historyService.logEvent(row.id, 'updated', actorUser, row.assigned_to,
        `Bulk update: ${parts.join('; ')}`, null, client);
    }
  });
  return { updated: orderedIds.length };
};

module.exports = {
  clientAssetError,
  getAvailableCompanyAssets,
  serialExists,
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
  bulkReturnAssets,
  bulkUpdateAssets,
  lockAsset,
};
