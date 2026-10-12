// Sign-in lockouts: employees from /api/employees carry `lockedUntil` (ISO
// timestamp, or null) after too many failed sign-ins.

/** Whether the employee's sign-in is locked right now. */
export const isSignInLocked = (employee, now = Date.now()) => {
  const until = employee?.lockedUntil;
  if (!until) return false;
  const time = new Date(until).getTime();
  return Number.isFinite(time) && time > now;
};

/** Whole minutes left on a lock (at least 1), or 0 when not locked. */
export const lockMinutesLeft = (employee, now = Date.now()) => {
  if (!isSignInLocked(employee, now)) return 0;
  return Math.max(1, Math.ceil((new Date(employee.lockedUntil).getTime() - now) / 60000));
};
