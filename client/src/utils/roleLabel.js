const KNOWN_ROLE_LABELS = {
  admin: 'Admin',
  hr: 'HR',
  it: 'IT',
  employee: 'Employee',
  director: 'Director',
};

/**
 * Display name for a person's role: the role's own name from the server
 * (`roleName`, e.g. "HR" or "IT Admin") when there is one, otherwise a tidy
 * version of the role key ("hr" -> "HR", "it_admin" -> "It Admin").
 */
export function roleLabel(person, fallback = '') {
  if (!person) return fallback;
  const named = typeof person.roleName === 'string' ? person.roleName.trim() : '';
  const key = typeof person.role === 'string' ? person.role.trim() : '';
  // roleName falls back to the raw key server-side; only trust it when it differs.
  if (named && named !== key) return named;
  if (!key) return named || fallback;
  if (KNOWN_ROLE_LABELS[key.toLowerCase()]) return KNOWN_ROLE_LABELS[key.toLowerCase()];
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
