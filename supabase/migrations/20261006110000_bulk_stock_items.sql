-- Bulk items without serial numbers (bags, mouse pads, cables): tracked as a
-- stock count. `stock_holdings` is who has how many right now; in stock =
-- total_quantity - SUM(holdings). Every change is logged in stock_history.

CREATE TABLE IF NOT EXISTS stock_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  location TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0),
  low_stock_threshold INTEGER CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The same item can be stocked at several offices, but only once per office.
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_name_location_key
  ON stock_items (LOWER(name), LOWER(COALESCE(location, ''))) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS stock_holdings (
  stock_item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  first_assigned_at DATE NOT NULL,
  last_assigned_at DATE NOT NULL,
  PRIMARY KEY (stock_item_id, employee_id)
);
CREATE INDEX IF NOT EXISTS stock_holdings_employee_idx ON stock_holdings (employee_id);

CREATE TABLE IF NOT EXISTS stock_history (
  id SERIAL PRIMARY KEY,
  stock_item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL
    CHECK (event_type IN ('created', 'restocked', 'removed', 'assigned', 'returned', 'written_off', 'updated', 'deleted')),
  quantity INTEGER NOT NULL DEFAULT 0,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  actor_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  performed_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stock_history_item_idx ON stock_history (stock_item_id, created_at DESC);
