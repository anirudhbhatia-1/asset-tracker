-- Where an employee works: at the office, hybrid, or fully remote. Set by
-- HR/Admin; everyone starts as 'office'.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_mode VARCHAR(10) NOT NULL DEFAULT 'office';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_work_mode_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_work_mode_check
      CHECK (work_mode IN ('office', 'hybrid', 'remote'));
  END IF;
END $$;
