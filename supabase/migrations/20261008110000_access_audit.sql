-- Access audit log: who changed whose access, roles, passwords and lockouts,
-- and who exported or imported data. Rows are append-only from the app.
-- Names are snapshotted so entries stay readable after people or roles are
-- renamed or removed. Purely additive.

CREATE TABLE IF NOT EXISTS access_audit (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  actor_name TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('employee', 'role', 'system')),
  target_id INTEGER,
  target_name TEXT,
  old_value JSONB,
  new_value JSONB,
  details JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS access_audit_created_at_idx ON access_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS access_audit_target_idx ON access_audit (target_type, target_id);
CREATE INDEX IF NOT EXISTS access_audit_actor_idx ON access_audit (actor_id);

-- Closed to Supabase's Data API like every other table
-- (see 20261008100000_lock_down_public_schema.sql).
ALTER TABLE access_audit ENABLE ROW LEVEL SECURITY;

-- Directors hold every permission implicitly; nobody else gets it by default.
INSERT INTO permissions (key, module, description)
VALUES ('audit:read', 'audit', 'View the access history')
ON CONFLICT (key) DO NOTHING;
