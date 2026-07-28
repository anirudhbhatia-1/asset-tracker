-- 1. Add columns to employees
ALTER TABLE employees ADD COLUMN password_hash TEXT;
ALTER TABLE employees ADD COLUMN role TEXT CHECK(role IN ('admin','employee','hr'));

-- 2. Migrate users data to employees
UPDATE employees e
SET 
  password_hash = u.password_hash,
  role = u.role
FROM users u
WHERE u.employee_id = e.id;

-- 3. Update sessions
ALTER TABLE sessions ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE;
UPDATE sessions s
SET employee_id = (SELECT employee_id FROM users u WHERE u.id = s.user_id);
-- Clean up old sessions that belonged to users with no employee_id (should be none, but just in case)
DELETE FROM sessions WHERE employee_id IS NULL;
ALTER TABLE sessions ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE sessions DROP COLUMN user_id;

-- 4. Update tickets (resolved_by)
ALTER TABLE tickets ADD COLUMN resolved_by_emp INTEGER REFERENCES employees(id) ON DELETE SET NULL;
UPDATE tickets t
SET resolved_by_emp = (SELECT employee_id FROM users u WHERE u.id = t.resolved_by)
WHERE resolved_by IS NOT NULL;
ALTER TABLE tickets DROP COLUMN resolved_by;
ALTER TABLE tickets RENAME COLUMN resolved_by_emp TO resolved_by;

-- 5. Update onboarding_requests (requested_by and arranged_by)
ALTER TABLE onboarding_requests ADD COLUMN requested_by_emp INTEGER REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE onboarding_requests ADD COLUMN arranged_by_emp INTEGER REFERENCES employees(id) ON DELETE SET NULL;

UPDATE onboarding_requests o
SET requested_by_emp = (SELECT employee_id FROM users u WHERE u.id = o.requested_by)
WHERE requested_by IS NOT NULL;

UPDATE onboarding_requests o
SET arranged_by_emp = (SELECT employee_id FROM users u WHERE u.id = o.arranged_by)
WHERE arranged_by IS NOT NULL;

-- Fix constraint for requested_by (it was NOT NULL previously)
-- We must make sure no requested_by_emp is NULL if it was originally required
DELETE FROM onboarding_requests WHERE requested_by_emp IS NULL AND requested_by IS NOT NULL;

ALTER TABLE onboarding_requests DROP COLUMN requested_by;
ALTER TABLE onboarding_requests DROP COLUMN arranged_by;
ALTER TABLE onboarding_requests RENAME COLUMN requested_by_emp TO requested_by;
ALTER TABLE onboarding_requests RENAME COLUMN arranged_by_emp TO arranged_by;
ALTER TABLE onboarding_requests ALTER COLUMN requested_by SET NOT NULL;

-- 6. Drop users table
DROP TABLE users CASCADE;
