const { pool } = require('../db');

// Read-only snapshot for the Thinkvibes People Portal: who holds which
// asset right now, keyed by email (the People Portal matches its employees
// by email). One call returns everything so the portal can cache it and
// never call AssetTrack once per page view. Nothing here writes, and what
// an employee would not see about their own assets (company cost, admin
// notes) is left out.
const getAssignmentsSnapshot = async () => {
  const [employees, assets, stock] = await Promise.all([
    pool.query(`
      SELECT name, LOWER(email) AS email, department, location
      FROM employees
      WHERE deleted_at IS NULL
      ORDER BY LOWER(email)`),
    // Accessories (adaptors, chargers) travel with their laptop, so they are
    // listed under it rather than as separate rows.
    pool.query(`
      SELECT a.id, a.name, a.model, a.serial_number, a.asset_type, a.client_name, a.assigned_date,
             TO_CHAR(a.warranty_expiry_date, 'YYYY-MM-DD') AS warranty_expiry_date,
             a.brand, a.processor, a.ram, a.storage, a.os,
             c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color,
             LOWER(e.email) AS email,
             COALESCE((
               SELECT json_agg(json_build_object('name', ch.name, 'serialNumber', ch.serial_number) ORDER BY ch.name)
               FROM assets ch WHERE ch.parent_id = a.id AND ch.assigned_to = a.assigned_to AND ch.status = 'in-use'
             ), '[]') AS accessories
      FROM assets a
      JOIN employees e ON e.id = a.assigned_to AND e.deleted_at IS NULL
      LEFT JOIN categories c ON c.id = a.category_id
      WHERE a.status = 'in-use'
        AND NOT EXISTS (
          SELECT 1 FROM assets p
          WHERE p.id = a.parent_id AND p.assigned_to = a.assigned_to AND p.status = 'in-use'
        )
      ORDER BY LOWER(e.email), a.assigned_date DESC NULLS LAST, a.name`),
    pool.query(`
      SELECT LOWER(e.email) AS email, s.name, c.name AS category_name, h.quantity, h.last_assigned_at
      FROM stock_holdings h
      JOIN employees e ON e.id = h.employee_id AND e.deleted_at IS NULL
      JOIN stock_items s ON s.id = h.stock_item_id
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE h.quantity > 0
      ORDER BY LOWER(e.email), s.name`),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    employees: employees.rows.map((r) => ({
      email: r.email, name: r.name, department: r.department || null, location: r.location || null,
    })),
    assets: assets.rows.map((r) => ({
      email: r.email,
      id: r.id,
      name: r.name,
      categoryName: r.category_name || null,
      categoryBadgeChar: r.category_badge_char || null,
      categoryColor: r.category_color || null,
      model: r.model || null,
      serialNumber: r.serial_number,
      assetType: r.asset_type || 'company',
      clientName: r.client_name || null,
      assignedDate: r.assigned_date || null,
      warrantyExpiryDate: r.warranty_expiry_date || null,
      brand: r.brand || null,
      processor: r.processor || null,
      ram: r.ram || null,
      storage: r.storage || null,
      os: r.os || null,
      accessories: r.accessories,
    })),
    stock: stock.rows.map((r) => ({
      email: r.email,
      name: r.name,
      categoryName: r.category_name || null,
      quantity: r.quantity,
      lastAssignedAt: r.last_assigned_at,
    })),
  };
};

module.exports = { getAssignmentsSnapshot };
