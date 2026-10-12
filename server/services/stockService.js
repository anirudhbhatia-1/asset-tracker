// Bulk items without serial numbers (bags, mouse pads, cables), tracked as a
// count. stock_holdings says who has how many; in stock is the total minus
// everything handed out. Every change is written to stock_history in the
// same transaction.
const { pool, withTransaction } = require('../db');
const { todayISO } = require('../utils/dates');
const auditService = require('./auditService');

const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const mapItem = (row) => {
  const total = Number(row.total_quantity);
  const givenOut = Number(row.given_out || 0);
  const threshold = row.low_stock_threshold == null ? null : Number(row.low_stock_threshold);
  const inStock = total - givenOut;
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.category_name || null,
    categoryColor: row.category_color || null,
    categoryBadgeChar: row.category_badge_char || null,
    location: row.location || null,
    purchaseDate: row.purchase_date || null,
    totalQuantity: total,
    givenOut,
    inStock,
    holdersCount: Number(row.holders_count || 0),
    costCents: row.cost_cents == null ? null : Number(row.cost_cents),
    lowStockThreshold: threshold,
    isLowStock: threshold != null && inStock <= threshold,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const ITEM_SELECT = `
  SELECT s.*, c.name AS category_name, c.color AS category_color, c.badge_char AS category_badge_char,
         COALESCE(h.given_out, 0) AS given_out, COALESCE(h.holders_count, 0) AS holders_count
  FROM stock_items s
  LEFT JOIN categories c ON c.id = s.category_id
  LEFT JOIN (
    SELECT stock_item_id, SUM(quantity) AS given_out, COUNT(*) AS holders_count
    FROM stock_holdings GROUP BY stock_item_id
  ) h ON h.stock_item_id = s.id`;

const logEvent = (client, itemId, eventType, { quantity = 0, employeeId = null, actor = null, note = null } = {}) => client.query(
  `INSERT INTO stock_history (stock_item_id, event_type, quantity, employee_id, actor_id, performed_by, note)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [itemId, eventType, quantity, employeeId, actor?.id || null, actor?.name || actor?.email || 'System', note || null]
);

// Locks the item and returns it with the current given-out count.
const lockItem = async (client, id) => {
  const { rows } = await client.query('SELECT * FROM stock_items WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [id]);
  if (!rows.length) throw httpError(404, 'Bulk item not found');
  const { rows: [{ given_out: givenOut }] } = await client.query(
    'SELECT COALESCE(SUM(quantity), 0)::int AS given_out FROM stock_holdings WHERE stock_item_id = $1', [id]
  );
  return { ...rows[0], givenOut };
};

const assertQuantity = (quantity, label = 'Quantity') => {
  const n = Number(quantity);
  if (!Number.isInteger(n) || n < 1 || n > 100000) throw httpError(400, `${label} must be a whole number from 1 to 100000`);
  return n;
};

const duplicateNameError = (err) => {
  if (err.code === '23505') return httpError(409, 'A bulk item with this name already exists at this location');
  return err;
};

const getItems = async ({ categoryId, location, q } = {}) => {
  const params = [];
  const conditions = ['s.deleted_at IS NULL'];
  if (categoryId) { params.push(categoryId); conditions.push(`s.category_id = $${params.length}`); }
  if (location) { params.push(location); conditions.push(`s.location = $${params.length}`); }
  if (q) { params.push(`%${q}%`); conditions.push(`(s.name ILIKE $${params.length} OR s.notes ILIKE $${params.length})`); }
  const { rows } = await pool.query(`${ITEM_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY s.name, s.location`, params);
  return rows.map(mapItem);
};

const getItemById = async (id) => {
  const { rows } = await pool.query(`${ITEM_SELECT} WHERE s.id = $1 AND s.deleted_at IS NULL`, [id]);
  if (!rows.length) throw httpError(404, 'Bulk item not found');
  const { rows: holders } = await pool.query(`
    SELECT h.employee_id, h.quantity, h.first_assigned_at, h.last_assigned_at,
           e.name, e.email, e.department, e.work_mode, e.deleted_at
    FROM stock_holdings h JOIN employees e ON e.id = h.employee_id
    WHERE h.stock_item_id = $1
    ORDER BY e.name`, [id]);
  const { rows: history } = await pool.query(`
    SELECT sh.id, sh.event_type, sh.quantity, sh.note, sh.performed_by, sh.created_at, e.name AS employee_name
    FROM stock_history sh LEFT JOIN employees e ON e.id = sh.employee_id
    WHERE sh.stock_item_id = $1
    ORDER BY sh.created_at DESC, sh.id DESC
    LIMIT 200`, [id]);
  return {
    ...mapItem(rows[0]),
    holders: holders.map((h) => ({
      employeeId: h.employee_id,
      name: h.name,
      email: h.email,
      department: h.department || null,
      workMode: h.work_mode || 'office',
      hasLeft: Boolean(h.deleted_at),
      quantity: h.quantity,
      firstAssignedAt: h.first_assigned_at,
      lastAssignedAt: h.last_assigned_at,
    })),
    history: history.map((h) => ({
      id: h.id,
      eventType: h.event_type,
      quantity: h.quantity,
      note: h.note || null,
      performedBy: h.performed_by || null,
      employeeName: h.employee_name || null,
      createdAt: h.created_at,
    })),
  };
};

const createItem = async (data, actor) => {
  const quantity = data.quantity === undefined || data.quantity === null ? 0 : Number(data.quantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) throw httpError(400, 'Quantity must be a whole number from 0 to 100000');
  try {
    const id = await withTransaction(async (client) => {
      const { rows: [row] } = await client.query(`
        INSERT INTO stock_items (name, category_id, location, total_quantity, cost_cents, low_stock_threshold, notes, purchase_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [data.name.trim(), data.categoryId || null, data.location || null, quantity,
        data.costCents ?? null, data.lowStockThreshold ?? null, data.notes || null, data.purchaseDate || null]);
      await logEvent(client, row.id, 'created', { quantity, actor, note: `Added with ${quantity} in stock` });
      return row.id;
    });
    return getItemById(id);
  } catch (err) {
    throw duplicateNameError(err);
  }
};

const UPDATABLE = { name: 'name', categoryId: 'category_id', location: 'location', costCents: 'cost_cents', lowStockThreshold: 'low_stock_threshold', notes: 'notes', purchaseDate: 'purchase_date' };

const updateItem = async (id, data, actor) => {
  const sets = [];
  const params = [id];
  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (data[key] === undefined) continue;
    let value = data[key];
    if (typeof value === 'string') value = value.trim();
    if (value === '') value = null;
    if (key === 'name' && !value) throw httpError(400, 'Name cannot be empty');
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  if (!sets.length) return getItemById(id);
  try {
    await withTransaction(async (client) => {
      await lockItem(client, id);
      await client.query(`UPDATE stock_items SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, params);
      await logEvent(client, id, 'updated', { actor, note: `Details updated (${Object.keys(data).filter((k) => UPDATABLE[k]).join(', ')})` });
    });
  } catch (err) {
    throw duplicateNameError(err);
  }
  return getItemById(id);
};

/**
 * Adds stock (`change` > 0, e.g. a new delivery) or removes it from the
 * shelf (`change` < 0, e.g. damaged in storage). Never below what is handed out.
 */
const adjustStock = async (id, change, note, actor) => {
  const delta = Number(change);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) {
    throw httpError(400, 'Change must be a non-zero whole number');
  }
  await withTransaction(async (client) => {
    const item = await lockItem(client, id);
    const inStock = item.total_quantity - item.givenOut;
    if (delta < 0 && -delta > inStock) {
      throw httpError(409, `Only ${inStock} in stock; the rest are with people. Take them back first.`);
    }
    await client.query('UPDATE stock_items SET total_quantity = total_quantity + $2, updated_at = NOW() WHERE id = $1', [id, delta]);
    await logEvent(client, id, delta > 0 ? 'restocked' : 'removed', { quantity: Math.abs(delta), actor, note });
  });
  return getItemById(id);
};

const assign = async (id, employeeId, quantity, note, actor, assignedDate = null) => {
  const n = assertQuantity(quantity);
  await withTransaction(async (client) => {
    const item = await lockItem(client, id);
    const { rows: [employee] } = await client.query(
      'SELECT id, name FROM employees WHERE id = $1 AND deleted_at IS NULL', [employeeId]
    );
    if (!employee) throw httpError(404, 'Employee not found');
    const inStock = item.total_quantity - item.givenOut;
    if (n > inStock) throw httpError(409, `Only ${inStock} ${item.name} in stock`);
    const date = assignedDate || todayISO();
    if (date > todayISO()) throw httpError(400, 'The date cannot be in the future');
    await client.query(`
      INSERT INTO stock_holdings (stock_item_id, employee_id, quantity, first_assigned_at, last_assigned_at)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (stock_item_id, employee_id) DO UPDATE
        SET quantity = stock_holdings.quantity + EXCLUDED.quantity,
            first_assigned_at = LEAST(stock_holdings.first_assigned_at, EXCLUDED.first_assigned_at),
            last_assigned_at = GREATEST(stock_holdings.last_assigned_at, EXCLUDED.last_assigned_at)`,
    [id, employeeId, n, date]);
    await logEvent(client, id, 'assigned', { quantity: n, employeeId, actor, note: note || `Given to ${employee.name}` });
  });
  return getItemById(id);
};

// Takes items back from someone: back on the shelf ('returned') or gone for
// good ('written_off', lost or broken — the total drops too).
const takeBack = async (id, employeeId, quantity, note, actor, { writeOff = false } = {}) => {
  const n = assertQuantity(quantity);
  await withTransaction(async (client) => {
    const item = await lockItem(client, id);
    const { rows: [holding] } = await client.query(
      `SELECT h.quantity, e.name FROM stock_holdings h JOIN employees e ON e.id = h.employee_id
       WHERE h.stock_item_id = $1 AND h.employee_id = $2 FOR UPDATE OF h`, [id, employeeId]
    );
    if (!holding) throw httpError(404, `This person has no ${item.name}`);
    if (n > holding.quantity) throw httpError(409, `${holding.name} only has ${holding.quantity} ${item.name}`);

    if (n === holding.quantity) {
      await client.query('DELETE FROM stock_holdings WHERE stock_item_id = $1 AND employee_id = $2', [id, employeeId]);
    } else {
      await client.query('UPDATE stock_holdings SET quantity = quantity - $3 WHERE stock_item_id = $1 AND employee_id = $2', [id, employeeId, n]);
    }
    if (writeOff) {
      await client.query('UPDATE stock_items SET total_quantity = total_quantity - $2, updated_at = NOW() WHERE id = $1', [id, n]);
    }
    await logEvent(client, id, writeOff ? 'written_off' : 'returned', {
      quantity: n, employeeId, actor,
      note: note || (writeOff ? `Lost or damaged by ${holding.name}` : `Returned by ${holding.name}`),
    });
  });
  return getItemById(id);
};

// Removes an item from the list; history is kept. Only when nobody has any.
const deleteItem = async (id, actor) => {
  await withTransaction(async (client) => {
    const item = await lockItem(client, id);
    if (item.givenOut > 0) throw httpError(409, `${item.givenOut} ${item.name} are still with people. Take them back first.`);
    await client.query('UPDATE stock_items SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);
    await logEvent(client, id, 'deleted', { actor });
    await auditService.record(client, {
      eventType: 'stock.deleted',
      actor,
      targetType: 'system',
      targetName: item.name,
      details: { stockItemId: Number(id), totalQuantity: Number(item.total_quantity) },
    });
  });
  return { id: Number(id), deleted: true };
};

// What one person holds (for their profile and the Employees drawer).
const getHoldingsForEmployee = async (employeeId) => {
  const { rows } = await pool.query(`
    SELECT h.stock_item_id, h.quantity, h.first_assigned_at, h.last_assigned_at,
           s.name, s.location, c.name AS category_name
    FROM stock_holdings h
    JOIN stock_items s ON s.id = h.stock_item_id
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE h.employee_id = $1
    ORDER BY s.name`, [employeeId]);
  return rows.map((r) => ({
    stockItemId: r.stock_item_id,
    name: r.name,
    location: r.location || null,
    categoryName: r.category_name || null,
    quantity: r.quantity,
    firstAssignedAt: r.first_assigned_at,
    lastAssignedAt: r.last_assigned_at,
  }));
};

module.exports = {
  getItems,
  getItemById,
  createItem,
  updateItem,
  adjustStock,
  assign,
  takeBack,
  deleteItem,
  getHoldingsForEmployee,
};
