const { pool } = require('../db');

const getLocations = async () => {
  const { rows } = await pool.query('SELECT * FROM locations ORDER BY name ASC');
  return rows;
};

const createLocation = async (name) => {
  const { rows } = await pool.query(
    'INSERT INTO locations (name) VALUES ($1) RETURNING *',
    [name]
  );
  return rows[0];
};

const updateLocationAddresses = async (id, addresses) => {
  const { rows } = await pool.query(
    'UPDATE locations SET addresses = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *',
    [JSON.stringify(addresses || []), id]
  );
  return rows[0];
};

module.exports = {
  getLocations,
  createLocation,
  updateLocationAddresses,
};
