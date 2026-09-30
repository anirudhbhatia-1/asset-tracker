-- Early migrations seeded test logins (admin@company.com as Director, etc.)
-- with one shared, publicly documented password hash. Any database built
-- from these migrations must not keep them: remove login access from every
-- account still using that exact hash. Local development re-seeds its own
-- test accounts afterwards (server/scripts/devDb.mjs) with fresh hashes.
DELETE FROM sessions WHERE employee_id IN (
  SELECT id FROM employees
  WHERE password_hash = '$2b$10$Ezttvv9RSPrPQEi2Ad1NyeULPhziHgFvKxt1nWxmP9fAfnXlGb7Fy'
);
UPDATE employees
SET password_hash = NULL, role = NULL, role_id = NULL, must_change_password = false
WHERE password_hash = '$2b$10$Ezttvv9RSPrPQEi2Ad1NyeULPhziHgFvKxt1nWxmP9fAfnXlGb7Fy';
