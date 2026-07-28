-- 1. Drop old constraints and add new ones to allow 'hr'
DO $$
DECLARE
    emp_cons_name TEXT;
    tick_cons_name TEXT;
BEGIN
    SELECT conname INTO emp_cons_name FROM pg_constraint WHERE conrelid = 'employees'::regclass AND conname LIKE '%admin_type%';
    IF emp_cons_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE employees DROP CONSTRAINT ' || emp_cons_name;
    END IF;

    SELECT conname INTO tick_cons_name FROM pg_constraint WHERE conrelid = 'tickets'::regclass AND conname LIKE '%current_admin_type%';
    IF tick_cons_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE tickets DROP CONSTRAINT ' || tick_cons_name;
    END IF;
END $$;

ALTER TABLE employees ADD CONSTRAINT employees_admin_type_check CHECK (admin_type IN ('it','hardware','hr'));
ALTER TABLE tickets ADD CONSTRAINT tickets_current_admin_type_check CHECK (current_admin_type IN ('it','hardware','hr'));

-- 2. Update existing HR user's admin_type to 'hr'
UPDATE employees SET admin_type = 'hr' WHERE email = 'hr@company.com';
