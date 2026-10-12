-- Per-account lockout after repeated failed password sign-ins.
-- failed_login_count counts consecutive failures; locked_until is set for
-- 15 minutes when it reaches the limit. Google sign-in ignores the lock.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
