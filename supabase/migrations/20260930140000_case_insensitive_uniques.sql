-- Serial numbers and emails are compared case-insensitively everywhere in
-- the app; enforce that in the database so "ABC123" and "abc123" (or two
-- spellings of one email) can never both exist.
UPDATE employees SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email));
CREATE UNIQUE INDEX IF NOT EXISTS assets_serial_number_lower_key ON assets (LOWER(serial_number));
CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_key ON employees (LOWER(email));

-- requested_by is NOT NULL, so "set null on delete" could never work; keep
-- the requester and refuse hard-deleting them instead (employees are
-- soft-deleted anyway).
ALTER TABLE onboarding_requests DROP CONSTRAINT IF EXISTS onboarding_requests_requested_by_emp_fkey;
ALTER TABLE onboarding_requests ADD CONSTRAINT onboarding_requests_requested_by_emp_fkey
  FOREIGN KEY (requested_by) REFERENCES employees(id) ON DELETE RESTRICT;
