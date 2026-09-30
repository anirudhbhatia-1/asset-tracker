-- These columns exist in production (added manually) and are used by the
-- code, but no earlier migration created them, so a fresh database built
-- from migrations was missing them. Idempotent: a no-op where they exist.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type VARCHAR NOT NULL DEFAULT 'company';
ALTER TABLE asset_history ADD COLUMN IF NOT EXISTS actor_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees ALTER COLUMN role SET DEFAULT 'employee';
