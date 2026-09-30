-- Databases built from the migrations have employees.role_id -> roles(id);
-- production was missing it (schema drift). Add it where absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'employees'::regclass AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (role_id) REFERENCES roles(id)%'
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT;
  END IF;
END $$;
