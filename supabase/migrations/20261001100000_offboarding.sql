-- Offboarding: the mirror of onboarding. HR starts an exit for an employee,
-- IT collects every asset they hold (returned or missing), and completing the
-- request can revoke their login. Purely additive: no existing table changes.

CREATE TABLE IF NOT EXISTS offboarding_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  last_working_date DATE NOT NULL,
  reason VARCHAR(30) CHECK (reason IN ('resignation', 'termination', 'contract_end', 'retirement', 'other')),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  revoke_access BOOLEAN NOT NULL DEFAULT true,
  requested_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  completed_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one open exit per employee.
CREATE UNIQUE INDEX IF NOT EXISTS offboarding_requests_one_open_per_employee
  ON offboarding_requests (employee_id) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS offboarding_requests_status_idx ON offboarding_requests (status);

-- One checklist row per asset the employee held. Name and serial are copied
-- so the record survives the asset being deleted later.
CREATE TABLE IF NOT EXISTS offboarding_items (
  id SERIAL PRIMARY KEY,
  offboarding_request_id INTEGER NOT NULL REFERENCES offboarding_requests(id) ON DELETE CASCADE,
  asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  asset_name TEXT NOT NULL,
  serial_number TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'returned', 'missing')),
  condition VARCHAR(20) CHECK (condition IN ('good', 'damaged')),
  notes TEXT,
  resolved_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (offboarding_request_id, asset_id)
);
CREATE INDEX IF NOT EXISTS offboarding_items_request_idx ON offboarding_items (offboarding_request_id);

INSERT INTO permissions (key, module, description) VALUES
  ('offboarding:read',    'offboarding', 'View employee exit requests and their asset checklists'),
  ('offboarding:create',  'offboarding', 'Start an exit (offboarding) for an employee'),
  ('offboarding:update',  'offboarding', 'Edit, cancel or complete exit requests'),
  ('offboarding:collect', 'offboarding', 'Mark assets as returned or missing during an exit')
ON CONFLICT (key) DO NOTHING;

-- Admin gets everything; HR runs the process but does not collect hardware.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key LIKE 'offboarding:%'
WHERE r.is_system AND r.name = 'Admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key IN ('offboarding:read', 'offboarding:create', 'offboarding:update')
WHERE r.is_system AND r.name = 'HR'
ON CONFLICT DO NOTHING;

-- Custom roles mirror what they can do in onboarding: whoever fulfils
-- onboarding collects at exit (only if they may already return assets from
-- Inventory); whoever creates onboarding starts exits.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.key = 'onboarding:fulfill'
JOIN roles r ON r.id = rp.role_id AND NOT r.is_system
JOIN permissions p ON p.key IN ('offboarding:read', 'offboarding:collect')
WHERE EXISTS (
  SELECT 1 FROM role_permissions rp2 JOIN permissions p2 ON p2.id = rp2.permission_id
  WHERE rp2.role_id = rp.role_id AND p2.key = 'assets:assign')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.key = 'onboarding:create'
JOIN roles r ON r.id = rp.role_id AND NOT r.is_system
JOIN permissions p ON p.key IN ('offboarding:read', 'offboarding:create', 'offboarding:update')
ON CONFLICT DO NOTHING;
