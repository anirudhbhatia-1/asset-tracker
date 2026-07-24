const { pool } = require('../db');

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

const getCategories = async () => {
  const result = await pool.query(`
    SELECT c.id, c.name, c.description, c.badge_char, c.color, c.created_at,
           COUNT(a.id) AS asset_count
    FROM categories c
    LEFT JOIN assets a ON c.id = a.category_id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  return result.rows.map(mapCategory);
};

const getCategoryById = async (id) => {
  const result = await pool.query(`
    SELECT c.id, c.name, c.description, c.badge_char, c.color, c.created_at,
           COUNT(a.id) AS asset_count
    FROM categories c
    LEFT JOIN assets a ON c.id = a.category_id
    WHERE c.id = $1
    GROUP BY c.id
  `, [id]);
  
  if (result.rows.length === 0) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }
  return mapCategory(result.rows[0]);
};

const createCategory = async (data) => {
  const { name, description, badgeChar, color } = data;
  
  // Check unique name
  const existing = await pool.query('SELECT id FROM categories WHERE name = $1', [name]);
  if (existing.rows.length > 0) {
    const err = new Error('Category name already exists');
    err.statusCode = 409;
    throw err;
  }

  const result = await pool.query(`
    INSERT INTO categories (name, description, badge_char, color, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id
  `, [name, description ?? null, badgeChar ?? null, color ?? null]);

  return getCategoryById(result.rows[0].id);
};

const updateCategory = async (id, data) => {
  const current = await getCategoryById(id); // throws 404 if not found
  const { name, description, badgeChar, color } = data;

  if (name && name !== current.name) {
    const existing = await pool.query('SELECT id FROM categories WHERE name = $1 AND id != $2', [name, id]);
    if (existing.rows.length > 0) {
      const err = new Error('Category name already exists');
      err.statusCode = 409;
      throw err;
    }
  }

  await pool.query(`
    UPDATE categories
    SET name = $1,
        description = $2,
        badge_char = $3,
        color = $4
    WHERE id = $5
  `, [
    name !== undefined ? name : current.name,
    description !== undefined ? description : current.description,
    badgeChar !== undefined ? badgeChar : current.badgeChar,
    color !== undefined ? color : current.color,
    id
  ]);

  return getCategoryById(id);
};

const deleteCategory = async (id) => {
  await getCategoryById(id); // throws 404 if not found

  // Check if any assets reference this category
  const countRes = await pool.query('SELECT COUNT(*) as count FROM assets WHERE category_id = $1', [id]);
  if (Number(countRes.rows[0].count) > 0) {
    const err = new Error(`Cannot delete category: referenced by ${countRes.rows[0].count} asset(s)`);
    err.statusCode = 409;
    throw err;
  }

  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  return { id: Number(id), deleted: true };
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
