const { pool } = require('../db');

const mapHistory = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name || null,
    assetSerialNumber: row.asset_serial_number || null,
    eventType: row.event_type,
    performedBy: row.performed_by || 'System',
    employeeId: row.employee_id || null,
    employeeName: row.employee_name || null,
    note: row.note || null,
    eventAt: row.event_at,
  };
};

const getRecentHistory = async (limit = 20) => {
  const result = await pool.query(`
    SELECT h.*, a.name AS asset_name, a.serial_number AS asset_serial_number, e.name AS employee_name
    FROM asset_history h
    LEFT JOIN assets a ON h.asset_id = a.id
    LEFT JOIN employees e ON h.employee_id = e.id
    ORDER BY h.event_at DESC, h.id DESC
    LIMIT $1
  `, [limit]);

  return result.rows.map(mapHistory);
};

const getAssetHistory = async (assetId, client = pool) => {
  const result = await client.query(`
    SELECT h.*, a.name AS asset_name, a.serial_number AS asset_serial_number, e.name AS employee_name
    FROM asset_history h
    LEFT JOIN assets a ON h.asset_id = a.id
    LEFT JOIN employees e ON h.employee_id = e.id
    WHERE h.asset_id = $1
    ORDER BY h.event_at DESC, h.id DESC
  `, [assetId]);

  return result.rows.map(mapHistory);
};

// Internal helper for logging append-only immutable audit events
const logEvent = async (assetId, eventType, performedBy = 'Rajan Sharma', employeeId = null, note = null, eventAt = null, client = pool) => {
  const result = await client.query(`
    INSERT INTO asset_history (asset_id, event_type, performed_by, employee_id, note, event_at)
    VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
    RETURNING id
  `, [assetId, eventType, performedBy, employeeId, note, eventAt]);

  return result.rows[0].id;
};

module.exports = {
  getRecentHistory,
  getAssetHistory,
  logEvent,
};
