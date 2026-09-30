-- Accounts flagged here must set a new password before using the app
-- (temporary passwords, and accounts that used a shared/default password).
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
