// In-memory stand-in for the tables the importers touch, so import tests run
// the real SQL call sequence (lookups, savepoints, inserts, parent links)
// without a database. Not a test file itself.
import { vi } from 'vitest';

export const createImportTestDb = ({
  employees = [],
  categories = [],
  locations = [],
  assets = [],
  failInsertFor = [],
} = {}) => {
  const state = {
    categories: categories.map((category, index) => ({ id: index + 1, ...category })),
    assets: assets.map((asset, index) => ({ id: 1000 + index, ...asset })),
    history: [],
    outcome: null,
  };
  let nextId = 5000;
  let savepoint = null;
  const snapshot = () => ({ assets: state.assets.map((asset) => ({ ...asset })), categories: [...state.categories] });
  const restore = (saved) => { state.assets = saved.assets; state.categories = saved.categories; };

  const pool = {
    query: vi.fn(async (sql) => {
      if (/FROM employees/.test(sql)) return { rows: employees };
      if (/FROM categories/.test(sql)) return { rows: state.categories.map(({ id, name }) => ({ id, name })) };
      if (/FROM locations/.test(sql)) return { rows: locations.map((name) => ({ name })) };
      if (/FROM assets/.test(sql)) return { rows: state.assets.map(({ id, serial_number }) => ({ id, serial_number })) };
      throw new Error(`Unexpected pool query: ${sql}`);
    }),
  };

  const client = {
    query: vi.fn(async (sql, params = []) => {
      const text = sql.trim();
      if (/^SAVEPOINT/.test(text)) { savepoint = snapshot(); return { rows: [] }; }
      if (/^RELEASE SAVEPOINT/.test(text)) { savepoint = null; return { rows: [] }; }
      if (/^ROLLBACK TO SAVEPOINT/.test(text)) { restore(savepoint); savepoint = null; return { rows: [] }; }
      if (/INSERT INTO categories/.test(text)) {
        const category = { id: nextId++, name: params[0] };
        state.categories.push(category);
        return { rows: [{ id: category.id }] };
      }
      if (/INSERT INTO assets/.test(text)) {
        const columns = text.match(/INSERT INTO assets\s*\(([^)]*)\)/)[1].split(',').map((column) => column.trim());
        const asset = { id: nextId++ };
        params.forEach((value, index) => { asset[columns[index]] = value; });
        if (failInsertFor.includes(asset.serial_number)) throw new Error(`simulated failure for ${asset.serial_number}`);
        if (state.assets.some((existing) => existing.serial_number === asset.serial_number)) {
          throw new Error('duplicate key value violates unique constraint "assets_serial_number_key"');
        }
        state.assets.push(asset);
        return { rows: [{ id: asset.id }] };
      }
      if (/UPDATE assets SET parent_id/.test(text)) {
        const asset = state.assets.find((row) => row.id === params[1]);
        if (asset) asset.parent_id = params[0];
        return { rows: [] };
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    }),
  };

  const withTransaction = async (callback) => {
    const saved = snapshot();
    try {
      const result = await callback(client);
      state.outcome = 'committed';
      return result;
    } catch (err) {
      restore(saved);
      state.outcome = 'rolled back';
      throw err;
    }
  };

  const logEvent = vi.fn(async (assetId, eventType, actor, employeeId, note) => {
    state.history.push({ assetId, eventType, employeeId, note });
  });

  const bySerial = (serial) => state.assets.find((asset) => asset.serial_number === serial);
  return { pool, client, withTransaction, logEvent, state, bySerial, dependencies: { pool, withTransaction, logEvent } };
};

export const STANDARD_CATEGORIES = ['Laptop', 'Monitor', 'Keyboard & Mouse', 'Audio & Headset', 'Adaptor', 'Laptop Stand']
  .map((name) => ({ name }));
