-- 1. Add admin_type to employees (for admin roles only)
ALTER TABLE employees ADD COLUMN admin_type TEXT CHECK (admin_type IN ('it','hardware'));

-- 2. Add current_admin_type to tickets (defaults to 'it')
ALTER TABLE tickets ADD COLUMN current_admin_type TEXT CHECK (current_admin_type IN ('it','hardware')) DEFAULT 'it';

-- 3. Create ticket_history table
CREATE TABLE ticket_history (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_type TEXT CHECK (event_type IN ('created','transferred','status_changed','resolved','rejected')) NOT NULL,
  performed_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  from_admin_type TEXT,
  to_admin_type TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);
CREATE INDEX idx_ticket_history_created_at ON ticket_history(created_at DESC);

-- 4. Seed Data: Update existing admin to 'it'
UPDATE employees SET admin_type = 'it' WHERE email = 'admin@company.com';

-- 5. Seed Data: Create new 'hardware' admin
-- Note: password_hash uses the same bcrypt hash pattern as the other test accounts
INSERT INTO employees (name, email, password_hash, role, admin_type)
VALUES (
  'Hardware Admin', 
  'hardwareadmin@company.com', 
  '$2b$10$Ezttvv9RSPrPQEi2Ad1NyeULPhziHgFvKxt1nWxmP9fAfnXlGb7Fy', 
  'admin', 
  'hardware'
);
