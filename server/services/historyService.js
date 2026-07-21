const db = require('../db');

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

const getRecentHistory = (limit = 20) => {
  const rows = db.prepare(`
    SELECT h.*, a.name AS asset_name, a.serial_number AS asset_serial_number, e.name AS employee_name
    FROM asset_history h
    LEFT JOIN assets a ON h.asset_id = a.id
    LEFT JOIN employees e ON h.employee_id = e.id
    ORDER BY h.event_at DESC, h.id DESC
    LIMIT ?
  `).all(limit);

  return rows.map(mapHistory);
};

const getAssetHistory = (assetId) => {
  const rows = db.prepare(`
    SELECT h.*, a.name AS asset_name, a.serial_number AS asset_serial_number, e.name AS employee_name
    FROM asset_history h
    LEFT JOIN assets a ON h.asset_id = a.id
    LEFT JOIN employees e ON h.employee_id = e.id
    WHERE h.asset_id = ?
    ORDER BY h.event_at DESC, h.id DESC
  `).all(assetId);

  return rows.map(mapHistory);
};

// Internal helper for logging append-only immutable audit events
const logEvent = (assetId, eventType, performedBy = 'Rajan Sharma', employeeId = null, note = null, eventAt = null) => {
  const timestamp = eventAt || new Date().toISOString().replace('T', ' ').substring(0, 19);
  const result = db.prepare(`
    INSERT INTO asset_history (asset_id, event_type, performed_by, employee_id, note, event_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(assetId, eventType, performedBy, employeeId, note, timestamp);

  return result.lastInsertRowid;
};

module.exports = {
  getRecentHistory,
  getAssetHistory,
  logEvent,
};
