-- Categories (created first; assets reference it)
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT    UNIQUE NOT NULL,
  description TEXT,
  badge_char  TEXT    CHECK(length(badge_char) <= 1),
  color       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id               SERIAL PRIMARY KEY,
  name             TEXT    NOT NULL,
  email            TEXT    UNIQUE NOT NULL,
  department       TEXT,
  location         TEXT,
  google_id        TEXT,
  avatar_url       TEXT,
  is_google_synced INTEGER DEFAULT 0,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id              SERIAL PRIMARY KEY,
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
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit / History Log
CREATE TABLE IF NOT EXISTS asset_history (
  id           SERIAL PRIMARY KEY,
  asset_id     INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_type   TEXT    NOT NULL
                       CHECK(event_type IN
                         ('created','assigned','returned','retired','deleted','updated')),
  performed_by TEXT,
  employee_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  note         TEXT,
  event_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  token            TEXT PRIMARY KEY,
  admin_identifier TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL
);

-- Google OAuth Configuration (single-row table)
CREATE TABLE IF NOT EXISTS google_config (
  id         SERIAL PRIMARY KEY,
  client_id  TEXT,
  domain     TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assets_status       ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category     ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_location     ON assets(location);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to  ON assets(assigned_to);

CREATE INDEX IF NOT EXISTS idx_history_asset_id    ON asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_history_event_at    ON asset_history(event_at DESC);

CREATE INDEX IF NOT EXISTS idx_employees_email     ON employees(email);
