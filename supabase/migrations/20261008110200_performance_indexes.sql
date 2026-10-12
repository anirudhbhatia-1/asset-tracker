-- Indexes for common lookups. Every one is IF NOT EXISTS, and none duplicates
-- an existing index (employees already has a unique index on LOWER(email):
-- employees_email_lower_key, so none is added here).

-- Session validation runs on every request; housekeeping deletes expired rows
-- and sign-out-everywhere deletes by employee.
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS sessions_employee_id_idx ON sessions (employee_id);

-- Role holder counts and the "remove role" check.
CREATE INDEX IF NOT EXISTS employees_role_id_idx ON employees (role_id);

-- Ticket lists are newest first and filtered by queue and status.
CREATE INDEX IF NOT EXISTS tickets_created_at_idx ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_admin_type_status_idx ON tickets (current_admin_type, status);

-- An asset's history, newest first.
CREATE INDEX IF NOT EXISTS asset_history_asset_event_at_idx ON asset_history (asset_id, event_at DESC);

-- The existing employee_id index on offboarding_requests is partial (open
-- exits only); listing an employee's past exits needs a full one.
CREATE INDEX IF NOT EXISTS offboarding_requests_employee_id_idx ON offboarding_requests (employee_id);
