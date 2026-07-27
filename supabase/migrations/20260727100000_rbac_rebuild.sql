DROP TABLE IF EXISTS onboarding_request_items CASCADE;
DROP TABLE IF EXISTS onboarding_requests CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin','employee','hr')) NOT NULL,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  type TEXT CHECK(type IN ('issue','request')) NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('open','in_progress','resolved','rejected')) DEFAULT 'open',
  resolution_notes TEXT,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_requests (
  id SERIAL PRIMARY KEY,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  new_hire_name TEXT NOT NULL,
  new_hire_email TEXT,
  department TEXT,
  location TEXT,
  joining_date DATE NOT NULL,
  notes TEXT,
  status TEXT CHECK(status IN ('pending','in_progress','arranged','completed','cancelled')) DEFAULT 'pending',
  linked_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  arranged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  arranged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_request_items (
  id SERIAL PRIMARY KEY,
  onboarding_request_id INTEGER NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  fulfilled_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL
);

CREATE INDEX idx_tickets_employee ON tickets(employee_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_onboarding_status ON onboarding_requests(status);
CREATE INDEX idx_onboarding_joining_date ON onboarding_requests(joining_date);

INSERT INTO users (email, password_hash, role, employee_id)
VALUES 
  ('admin@company.com', '$2b$10$Ezttvv9RSPrPQEi2Ad1NyeULPhziHgFvKxt1nWxmP9fAfnXlGb7Fy', 'admin', NULL),
  ('employee@company.com', '$2b$10$Ezttvv9RSPrPQEi2Ad1NyeULPhziHgFvKxt1nWxmP9fAfnXlGb7Fy', 'employee', (SELECT id FROM employees LIMIT 1)),
  ('hr@company.com', '$2b$10$Ezttvv9RSPrPQEi2Ad1NyeULPhziHgFvKxt1nWxmP9fAfnXlGb7Fy', 'hr', NULL);
