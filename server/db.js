const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = path.resolve(__dirname, process.env.DATABASE_PATH || '../data/assets.db');

// Ensure parent directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Initialize Schema
function initSchema() {
  db.exec(`
    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    UNIQUE NOT NULL,
      description TEXT,
      badge_char  TEXT    CHECK(length(badge_char) <= 1),
      color       TEXT,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    -- Employees
    CREATE TABLE IF NOT EXISTS employees (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      email            TEXT    UNIQUE NOT NULL,
      department       TEXT,
      location         TEXT,
      google_id        TEXT,
      avatar_url       TEXT,
      is_google_synced INTEGER DEFAULT 0,
      deleted_at       TEXT,
      created_at       TEXT    DEFAULT (datetime('now'))
    );

    -- Assets
    CREATE TABLE IF NOT EXISTS assets (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      model           TEXT,
      serial_number   TEXT    UNIQUE NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'available'
                              CHECK(status IN ('available','in-use','retired')),
      location        TEXT,
      cost_cents      INTEGER DEFAULT 0,
      purchase_date   TEXT,
      notes           TEXT,
      assigned_to     INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      assigned_date   TEXT,
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    );

    -- Audit / History Log
    CREATE TABLE IF NOT EXISTS asset_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id     INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      event_type   TEXT    NOT NULL
                           CHECK(event_type IN
                             ('created','assigned','returned','retired','deleted','updated')),
      performed_by TEXT,
      employee_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      note         TEXT,
      event_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Google OAuth Configuration (single-row table)
    CREATE TABLE IF NOT EXISTS google_config (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id  TEXT,
      domain     TEXT,
      updated_at TEXT    DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_assets_status       ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_assets_category     ON assets(category_id);
    CREATE INDEX IF NOT EXISTS idx_assets_location     ON assets(location);
    CREATE INDEX IF NOT EXISTS idx_assets_assigned_to  ON assets(assigned_to);

    CREATE INDEX IF NOT EXISTS idx_history_asset_id    ON asset_history(asset_id);
    CREATE INDEX IF NOT EXISTS idx_history_event_at    ON asset_history(event_at DESC);

    CREATE INDEX IF NOT EXISTS idx_employees_email     ON employees(email);
  `);

  // Ensure single row in google_config if empty
  const countGoogleConfig = db.prepare('SELECT COUNT(*) as count FROM google_config').get().count;
  if (countGoogleConfig === 0) {
    db.prepare('INSERT INTO google_config (client_id, domain) VALUES (?, ?)').run('', '');
  }
}

// Seed Database if empty
function seedIfEmpty() {
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get().count;

  if (categoryCount === 0 && assetCount === 0) {
    console.log('Seeding initial database with 4 categories, 8 employees, and 15 sample assets...');

    const runSeed = db.transaction(() => {
      // 1. Insert Categories (4 categories)
      const insertCategory = db.prepare(`
        INSERT INTO categories (name, description, badge_char, color, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);
      insertCategory.run('Laptop', 'MacBooks, ThinkPads and Workstations', 'L', 'Indigo');
      insertCategory.run('Monitor', 'External 4K and UltraWide monitors', 'M', 'Blue');
      insertCategory.run('Keyboard & Mouse', 'Mechanical keyboards, ergonomics, trackpads', 'K', 'Teal');
      insertCategory.run('Audio & Headset', 'Noise-canceling headphones, headsets, and microphones', 'A', 'Purple');

      // 2. Insert Employees (8 employees across 4 offices)
      const insertEmployee = db.prepare(`
        INSERT INTO employees (name, email, department, location, is_google_synced, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `);
      insertEmployee.run('Rajan Sharma', 'rajan.sharma@company.com', 'IT Operations', 'Bangalore', 1);
      insertEmployee.run('Priya Nair', 'priya.nair@company.com', 'Operations', 'Mumbai', 1);
      insertEmployee.run('Sneha Kulkarni', 'sneha.kulkarni@company.com', 'Finance', 'Hyderabad', 1);
      insertEmployee.run('Arjun Rao', 'arjun.rao@company.com', 'Engineering', 'Bangalore', 1);
      insertEmployee.run('Ananya Verma', 'ananya.verma@company.com', 'Product', 'Delhi', 1);
      insertEmployee.run('Vikram Patel', 'vikram.patel@company.com', 'Engineering', 'Mumbai', 0);
      insertEmployee.run('Divya Menon', 'divya.menon@company.com', 'Design', 'Bangalore', 1);
      insertEmployee.run('Rohit Gupta', 'rohit.gupta@company.com', 'Marketing', 'Hyderabad', 0);

      // 3. Insert Assets (15 sample assets with mixed statuses across 4 offices)
      const insertAsset = db.prepare(`
        INSERT INTO assets (name, category_id, model, serial_number, status, location, cost_cents, purchase_date, notes, assigned_to, assigned_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertHistory = db.prepare(`
        INSERT INTO asset_history (asset_id, event_type, performed_by, employee_id, note, event_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const sampleAssets = [
        // 1. Laptop - assigned
        { name: 'MacBook Pro 16" M3 Max', category_id: 1, model: 'Apple MacBook Pro (16-inch, M3 Max, 36GB)', serial_number: 'SN-MBP16M3X01', status: 'in-use', location: 'Bangalore', cost_cents: 349900, purchase_date: '2025-11-15', notes: 'Primary dev machine for Engineering Lead', assigned_to: 4, assigned_date: '2025-11-20' },
        // 2. Laptop - assigned
        { name: 'MacBook Air 15" M3', category_id: 1, model: 'Apple MacBook Air (15-inch, M3, 16GB)', serial_number: 'SN-MBA15M3X02', status: 'in-use', location: 'Delhi', cost_cents: 169900, purchase_date: '2026-01-10', notes: 'Product Management standard laptop', assigned_to: 5, assigned_date: '2026-01-12' },
        // 3. Laptop - assigned
        { name: 'ThinkPad X1 Carbon Gen 11', category_id: 1, model: 'Lenovo ThinkPad X1 Carbon (Intel i7, 32GB)', serial_number: 'SN-TPX1C11003', status: 'in-use', location: 'Mumbai', cost_cents: 219900, purchase_date: '2025-08-01', notes: 'Engineering team laptop', assigned_to: 6, assigned_date: '2025-08-05' },
        // 4. Laptop - available
        { name: 'MacBook Pro 14" M3 Pro', category_id: 1, model: 'Apple MacBook Pro (14-inch, M3 Pro, 18GB)', serial_number: 'SN-MBP14M3P04', status: 'available', location: 'Bangalore', cost_cents: 249900, purchase_date: '2026-03-01', notes: 'Spare high-performance laptop in HQ inventory', assigned_to: null, assigned_date: null },
        // 5. Laptop - available
        { name: 'Dell XPS 15 9530', category_id: 1, model: 'Dell XPS 15 (OLED 3.5K, i9, 32GB)', serial_number: 'SN-XPS15D9005', status: 'available', location: 'Hyderabad', cost_cents: 229900, purchase_date: '2026-02-15', notes: 'Available stock in Hyderabad IT room', assigned_to: null, assigned_date: null },
        // 6. Laptop - retired
        { name: 'MacBook Pro 13" 2020 (Intel)', category_id: 1, model: 'Apple MacBook Pro (13-inch, Intel i5, 16GB)', serial_number: 'SN-MBP13I2006', status: 'retired', location: 'Bangalore', cost_cents: 149900, purchase_date: '2020-07-10', notes: 'Retired due to battery swelling and keyboard degradation', assigned_to: null, assigned_date: null },
        // 7. Monitor - assigned
        { name: 'Dell UltraSharp 27" 4K USB-C', category_id: 2, model: 'Dell U2723QE 27-inch 4K UHD IPS Black', serial_number: 'SN-DELL274K07', status: 'in-use', location: 'Bangalore', cost_cents: 64900, purchase_date: '2025-11-15', notes: 'Paired with MacBook Pro 16', assigned_to: 4, assigned_date: '2025-11-20' },
        // 8. Monitor - assigned
        { name: 'LG 34" UltraWide QHD Curved', category_id: 2, model: 'LG 34WN80C-B 34-inch UltraWide QHD IPS USB-C', serial_number: 'SN-LG34UW0008', status: 'in-use', location: 'Bangalore', cost_cents: 74900, purchase_date: '2026-01-05', notes: 'Design lead workstation setup', assigned_to: 7, assigned_date: '2026-01-08' },
        // 9. Monitor - available
        { name: 'BenQ PD2705Q 27" 2K QHD', category_id: 2, model: 'BenQ Designer Monitor 27-inch QHD IPS USB-C', serial_number: 'SN-BENQ27K009', status: 'available', location: 'Mumbai', cost_cents: 39900, purchase_date: '2026-04-10', notes: 'Brand new stock ready for assignment in Mumbai', assigned_to: null, assigned_date: null },
        // 10. Monitor - retired
        { name: 'HP E243 23.8" FHD Monitor', category_id: 2, model: 'HP EliteDisplay E243 23.8-inch IPS', serial_number: 'SN-HPE243M010', status: 'retired', location: 'Delhi', cost_cents: 19900, purchase_date: '2019-05-12', notes: 'Screen flickers continuously; decommissioned', assigned_to: null, assigned_date: null },
        // 11. Keyboard/Mouse - assigned
        { name: 'Logitech MX Master 3S Wireless Mouse', category_id: 3, model: 'Logitech MX Master 3S Performance Wireless Mouse', serial_number: 'SN-LOGIMX3S11', status: 'in-use', location: 'Bangalore', cost_cents: 9900, purchase_date: '2025-11-15', notes: 'Ergonomic setup for Arjun', assigned_to: 4, assigned_date: '2025-11-20' },
        // 12. Keyboard/Mouse - assigned
        { name: 'Keychron Q1 Pro Mechanical Keyboard', category_id: 3, model: 'Keychron Q1 Pro 75% Wireless Custom Mechanical Keyboard', serial_number: 'SN-KEYCHQ1P12', status: 'in-use', location: 'Bangalore', cost_cents: 19900, purchase_date: '2026-01-05', notes: 'Custom keyboard with Gateron Red switches', assigned_to: 7, assigned_date: '2026-01-08' },
        // 13. Keyboard/Mouse - available
        { name: 'Apple Magic Trackpad (Black)', category_id: 3, model: 'Apple Magic Trackpad - Multi-Touch Surface', serial_number: 'SN-APLTRK0013', status: 'available', location: 'Bangalore', cost_cents: 14900, purchase_date: '2026-03-15', notes: 'Available in Bangalore IT locker', assigned_to: null, assigned_date: null },
        // 14. Audio/Headset - assigned
        { name: 'Sony WH-1000XM5 Noise Canceling Headphones', category_id: 4, model: 'Sony WH-1000XM5 Wireless Industry Leading Noise Canceling', serial_number: 'SN-SONYXM5014', status: 'in-use', location: 'Hyderabad', cost_cents: 39900, purchase_date: '2026-02-10', notes: 'Assigned to Finance team for quiet review sessions', assigned_to: 3, assigned_date: '2026-02-12' },
        // 15. Audio/Headset - available
        { name: 'Jabra Evolve2 65 UC Wireless Headset', category_id: 4, model: 'Jabra Evolve2 65 Stereo Wireless Headset with Charging Stand', serial_number: 'SN-JABRA65015', status: 'available', location: 'Delhi', cost_cents: 24900, purchase_date: '2026-04-01', notes: 'Ready for next hire in Delhi office', assigned_to: null, assigned_date: null }
      ];

      for (const item of sampleAssets) {
        const createdTimestamp = `${item.purchase_date} 10:00:00`;
        const updatedTimestamp = item.assigned_date ? `${item.assigned_date} 14:30:00` : createdTimestamp;

        const res = insertAsset.run(
          item.name, item.category_id, item.model, item.serial_number, item.status,
          item.location, item.cost_cents, item.purchase_date, item.notes,
          item.assigned_to, item.assigned_date, createdTimestamp, updatedTimestamp
        );

        const assetId = res.lastInsertRowid;

        // Log Created event
        insertHistory.run(assetId, 'created', 'Rajan Sharma', null, `Initial registration: ${item.name}`, createdTimestamp);

        // If assigned, log Assigned event
        if (item.status === 'in-use' && item.assigned_to) {
          insertHistory.run(assetId, 'assigned', 'Rajan Sharma', item.assigned_to, 'Allocated hardware to employee', updatedTimestamp);
        }

        // If retired, log Retired event
        if (item.status === 'retired') {
          insertHistory.run(assetId, 'retired', 'Rajan Sharma', null, item.notes, '2026-05-01 11:00:00');
        }
      }
    });

    runSeed();
    console.log('Initial seeding completed successfully.');
  }
}

initSchema();
seedIfEmpty();

module.exports = db;
