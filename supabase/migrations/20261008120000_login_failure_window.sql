-- Lockout policy v2: 20 failed password sign-ins within a rolling hour lock
-- the account for 15 minutes. last_failed_login_at is when the most recent
-- attempt was counted; if it is more than an hour old, the next failure
-- starts the count again at 1 (see server/services/authService.js).
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ;
