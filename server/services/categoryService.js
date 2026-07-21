const db = require('../db');

const mapCategory = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    badgeChar: row.badge_char || null,
    color: row.color || null,
    createdAt: row.created_at,
    assetCount: row.asset_count !== undefined ? Number(row.asset_count) : undefined,
  };
};

const getCategories = () => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.description, c.badge_char, c.color, c.created_at,
           COUNT(a.id) AS asset_count
    FROM categories c
    LEFT JOIN assets a ON c.id = a.category_id
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();
  return rows.map(mapCategory);
};

const getCategoryById = (id) => {
  const row = db.prepare(`
    SELECT c.id, c.name, c.description, c.badge_char, c.color, c.created_at,
           COUNT(a.id) AS asset_count
    FROM categories c
    LEFT JOIN assets a ON c.id = a.category_id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id);
  if (!row) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }
  return mapCategory(row);
};

const createCategory = (data) => {
  const { name, description, badgeChar, color } = data;
  
  // Check unique name
  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
  if (existing) {
    const err = new Error('Category name already exists');
    err.statusCode = 409;
    throw err;
  }

  const result = db.prepare(`
    INSERT INTO categories (name, description, badge_char, color, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(name, description ?? null, badgeChar ?? null, color ?? null);

  return getCategoryById(result.lastInsertRowid);
};

const updateCategory = (id, data) => {
  const current = getCategoryById(id); // throws 404 if not found
  const { name, description, badgeChar, color } = data;

  if (name && name !== current.name) {
    const existing = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name, id);
    if (existing) {
      const err = new Error('Category name already exists');
      err.statusCode = 409;
      throw err;
    }
  }

  db.prepare(`
    UPDATE categories
    SET name = ?,
        description = ?,
        badge_char = ?,
        color = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name : current.name,
    description !== undefined ? description : current.description,
    badgeChar !== undefined ? badgeChar : current.badgeChar,
    color !== undefined ? color : current.color,
    id
  );

  return getCategoryById(id);
};

const deleteCategory = (id) => {
  const current = getCategoryById(id); // throws 404 if not found

  // Check if any assets reference this category (Rule 10 in AssetTrack_Memory.md)
  const countRow = db.prepare('SELECT COUNT(*) as count FROM assets WHERE category_id = ?').get(id);
  if (countRow.count > 0) {
    const err = new Error(`Cannot delete category: referenced by ${countRow.count} asset(s)`);
    err.statusCode = 409;
    throw err;
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { id: Number(id), deleted: true };
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
