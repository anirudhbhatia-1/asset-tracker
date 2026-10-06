/**
 * Distinct, sorted department names from a list of employees (blank or
 * punctuation-only values skipped), optionally merged with a list of defaults.
 */
export function distinctDepartments(employees, defaults = []) {
  const names = new Set(defaults);
  (Array.isArray(employees) ? employees : []).forEach((emp) => {
    const dep = typeof emp?.department === 'string' ? emp.department.trim() : '';
    // Skip junk values such as "," that have no letters or digits.
    if (/[\p{L}\p{N}]/u.test(dep)) names.add(dep);
  });
  return [...names].sort((a, b) => a.localeCompare(b));
}
