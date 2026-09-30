-- A role on an employee means "has been granted login access" (password or
-- Google). The column default gave every directory entry a role, so anyone
-- added to the directory could sign in with Google without being granted
-- access, and "Grant Access" always failed with "already has a login".
ALTER TABLE employees ALTER COLUMN role DROP DEFAULT;

-- Directory-only entries (no password, no Google link) never had access.
UPDATE employees
SET role = NULL, role_id = NULL
WHERE password_hash IS NULL AND google_id IS NULL AND role IS NOT NULL;
