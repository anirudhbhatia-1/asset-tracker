// Plain-English sentences for the access history (GET /api/audit).
//
//   describeAuditEvent({ eventType: 'employee.role_changed', actorName: 'Asha',
//     targetName: 'Ravi', oldValue: { role: 'Employee' }, newValue: { role: 'Director' } })
//   → "Asha changed Ravi's role from Employee to Director"
//
// Every field may be missing (old rows, deleted people, events the server
// added later), so each sentence degrades to something still true rather
// than printing "undefined".

// The filter groups on the Access history page, and the event-type prefix
// (or exact types) each one sends to the server.
export const AUDIT_EVENT_GROUPS = [
  { value: 'all', label: 'All', eventTypes: [] },
  { value: 'roles', label: 'Roles & permissions', eventTypes: ['employee.role_changed', 'role.'] },
  { value: 'access', label: 'Login access', eventTypes: ['employee.access_granted', 'employee.access_revoked', 'employee.email_changed'] },
  { value: 'passwords', label: 'Passwords & lockouts', eventTypes: ['employee.password_reset', 'password.', 'account.'] },
  { value: 'people', label: 'People & exits', eventTypes: ['employee.created', 'employee.removed', 'offboarding.'] },
  { value: 'data', label: 'Data, exports & deletions', eventTypes: ['data.', 'asset.deleted', 'stock.deleted'] },
];

/** The eventType query value for a group: comma-separated types/prefixes, or undefined for all. */
export const eventTypeParamFor = (group) => {
  const found = AUDIT_EVENT_GROUPS.find((g) => g.value === group);
  return found && found.eventTypes.length ? found.eventTypes.join(',') : undefined;
};

/** Whether an event type falls in a filter group (exact types, or prefixes ending in '.'). */
export const eventInGroup = (eventType, group) => {
  const found = AUDIT_EVENT_GROUPS.find((g) => g.value === group);
  if (!found || found.eventTypes.length === 0) return true;
  const type = String(eventType || '');
  return found.eventTypes.some((t) => (t.endsWith('.') ? type.startsWith(t) : type === t));
};

/** Which filter group an event belongs to (for icons/colours); 'other' when none. */
export const auditGroupOf = (eventType = '') => {
  const group = AUDIT_EVENT_GROUPS.find((g) => g.eventTypes.length && eventInGroup(eventType, g.value));
  return group ? group.value : 'other';
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const obj = (v) => {
  if (isObject(v)) return v;
  // Some drivers hand JSON columns back as text.
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
const firstOf = (...values) => values.map(text).find(Boolean) || '';
const num = (...values) => {
  for (const v of values) {
    const n = Number(v);
    if (v !== null && v !== undefined && v !== '' && Number.isFinite(n)) return n;
  }
  return null;
};

const possessive = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

// "a", "a and b", "a, b and c"; long lists end with "and N more".
export const listOf = (items, max = 4) => {
  const clean = (Array.isArray(items) ? items : []).map(text).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length > max) return `${clean.slice(0, max).join(', ')} and ${clean.length - max} more`;
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
};

const actorOf = (e) => text(e.actorName) || (e.actorId ? 'Someone' : 'The system');
const targetOf = (e, fallback = 'an employee') => text(e.targetName) || fallback;
const isSelf = (e) => e.actorId != null && e.targetId != null && String(e.actorId) === String(e.targetId);

const roleChange = (e, oldV, newV) => {
  const actor = actorOf(e);
  const target = targetOf(e);
  const from = firstOf(oldV.role, oldV.roleName, oldV.name);
  const to = firstOf(newV.role, newV.roleName, newV.name);
  if (from && to) return `${actor} changed ${possessive(target)} role from ${from} to ${to}`;
  if (to) return `${actor} changed ${possessive(target)} role to ${to}`;
  return `${actor} changed ${possessive(target)} role`;
};

const roleUpdated = (e, oldV, newV) => {
  const actor = actorOf(e);
  const role = firstOf(e.targetName, newV.name, oldV.name) || 'a role';
  const added = Array.isArray(newV.permissionsAdded) ? newV.permissionsAdded : [];
  const removed = Array.isArray(newV.permissionsRemoved) ? newV.permissionsRemoved : [];
  const renamedFrom = text(oldV.name);
  const renamedTo = text(newV.name);
  const parts = [];
  if (renamedFrom && renamedTo && renamedFrom !== renamedTo) parts.push(`renamed role ${renamedFrom} to ${renamedTo}`);
  if (added.length) parts.push(`added ${plural(added.length, 'permission')} to role ${role}: ${listOf(added)}`);
  if (removed.length) {
    parts.push(`removed ${plural(removed.length, 'permission')} from role ${role}: ${listOf(removed)}`);
  }
  if (parts.length === 0) return `${actor} updated role ${role}`;
  // Name the role once when the sentence already did ("renamed role X to Y").
  if (parts.length === 1) return `${actor} ${parts[0]}`;
  return `${actor} ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

const dataEvent = (e, verb, details, newV) => {
  const actor = actorOf(e);
  const count = num(details.count, details.rows, details.total, newV.count, details.imported, details.created);
  const what = firstOf(details.entity, details.resource, details.type, e.targetName, newV.entity) || 'records';
  const noun = what.toLowerCase();
  // "347 assets" / "1 asset"; free-form entities are used as given.
  const singular = noun.endsWith('s') ? noun.slice(0, -1) : noun;
  const pluralNoun = noun.endsWith('s') ? noun : `${noun}s`;
  if (count !== null) return `${actor} ${verb} ${plural(count, singular, pluralNoun)}`;
  return `${actor} ${verb} ${pluralNoun}`;
};

const BUILDERS = {
  'employee.role_changed': roleChange,
  'employee.access_granted': (e, _old, newV) => {
    const role = firstOf(newV.role, newV.roleName);
    return `${actorOf(e)} gave ${targetOf(e)} sign-in access${role ? ` as ${role}` : ''}`;
  },
  'employee.access_revoked': (e) => `${actorOf(e)} removed ${possessive(targetOf(e))} sign-in access`,
  'employee.password_reset': (e) => `${actorOf(e)} reset ${possessive(targetOf(e))} password`,
  'employee.email_changed': (e, oldV, newV) => {
    const from = text(oldV.email);
    const to = text(newV.email);
    const base = `${actorOf(e)} changed ${possessive(targetOf(e))} email`;
    if (from && to) return `${base} from ${from} to ${to}`;
    if (to) return `${base} to ${to}`;
    return base;
  },
  'employee.created': (e, _old, newV, details) => {
    const where = text(newV.department);
    return `${actorOf(e)} added ${targetOf(e)} to the directory`
      + (where ? ` (${where})` : '')
      + (details.withLogin ? ' with sign-in access' : '');
  },
  'employee.removed': (e) => `${actorOf(e)} removed ${targetOf(e)} from the directory`,
  'offboarding.started': (e, _old, newV, details) => {
    const day = text(newV.lastWorkingDate);
    const toCollect = num(details.assetsToCollect);
    return `${actorOf(e)} started ${possessive(targetOf(e))} offboarding`
      + (day ? ` (last day ${day}` : '')
      + (day && toCollect !== null ? `, ${plural(toCollect, 'asset')} to collect)` : (day ? ')' : ''));
  },
  'offboarding.completed': (e, _old, _new, details) => {
    const extras = [
      details.revokedAccess ? 'revoked their sign-in' : null,
      details.removedFromDirectory ? 'removed them from the directory' : null,
      num(details.missing) ? `${plural(num(details.missing), 'asset')} written off as missing` : null,
    ].filter(Boolean);
    return `${actorOf(e)} completed ${possessive(targetOf(e))} offboarding`
      + (extras.length ? ` and ${extras.join(', ')}` : '');
  },
  'offboarding.cancelled': (e) => `${actorOf(e)} cancelled ${possessive(targetOf(e))} offboarding`,
  'asset.deleted': (e, _old, _new, details) => (
    `${actorOf(e)} permanently deleted asset ${firstOf(e.targetName, details.serialNumber) || ''}`.trim()
  ),
  'stock.deleted': (e, _old, _new, details) => {
    const qty = num(details.totalQuantity);
    return `${actorOf(e)} removed bulk item ${text(e.targetName) || ''}`.trim()
      + (qty !== null ? ` (${qty} in total)` : '');
  },
  'password.changed': (e) => (isSelf(e) || !e.targetName
    ? `${actorOf(e)} changed their password`
    : `${actorOf(e)} changed ${possessive(targetOf(e))} password`),
  'account.locked': (e, _old, newV, details) => {
    const attempts = num(details.failedAttempts, details.attempts, details.failedLogins, newV.failedAttempts);
    const target = text(e.targetName);
    const base = target ? `${possessive(target)} account was locked` : 'An account was locked';
    return attempts !== null ? `${base} after ${plural(attempts, 'failed sign-in')}` : `${base} after too many failed sign-ins`;
  },
  'account.unlocked': (e) => {
    const target = targetOf(e, 'an account');
    // No actor: the lock simply ran out.
    if (!e.actorId && !e.actorName) return `${possessive(target)} account was unlocked`;
    return `${actorOf(e)} unlocked ${possessive(target)} account`;
  },
  'role.created': (e, _old, newV) => `${actorOf(e)} created role ${firstOf(e.targetName, newV.name) || 'a new role'}`,
  'role.updated': roleUpdated,
  'role.deleted': (e, oldV) => `${actorOf(e)} deleted role ${firstOf(e.targetName, oldV.name) || 'a role'}`,
  'data.exported': (e, _old, newV, details) => dataEvent(e, 'exported', details, newV),
  'data.imported': (e, _old, newV, details) => dataEvent(e, 'imported', details, newV),
};

// "employee.something_new" → "something new"
const humanType = (type) => text(type).split('.').pop().replace(/[_-]+/g, ' ').trim();

/** One readable sentence for an audit row; unknown types get a generic one. */
export const describeAuditEvent = (event) => {
  const e = event || {};
  const oldV = obj(e.oldValue);
  const newV = obj(e.newValue);
  const details = obj(e.details);
  const build = BUILDERS[e.eventType];
  if (build) return build(e, oldV, newV, details);
  const action = humanType(e.eventType) || 'an action';
  const target = text(e.targetName);
  return `${actorOf(e)} recorded "${action}"${target ? ` for ${target}` : ''}`;
};

const LABELS = {
  role: 'Role',
  roleName: 'Role',
  email: 'Email',
  name: 'Name',
  permissionsAdded: 'Permissions added',
  permissionsRemoved: 'Permissions removed',
  lockedUntil: 'Locked until',
  failedAttempts: 'Failed sign-ins',
  count: 'Count',
  ip: 'IP address',
};

export const auditFieldLabel = (key) => LABELS[key]
  || String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

export const formatAuditValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.map(formatAuditValue).join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/**
 * Rows for the expandable "details" section: [{ key, label, from, to }]
 * for every field in old/new values, plus any extra details (from: null).
 */
export const auditChangeRows = (event) => {
  const e = event || {};
  const oldV = obj(e.oldValue);
  const newV = obj(e.newValue);
  const details = obj(e.details);
  const keys = [...new Set([...Object.keys(oldV), ...Object.keys(newV)])];
  const rows = keys.map((key) => ({
    key,
    label: auditFieldLabel(key),
    from: key in oldV ? formatAuditValue(oldV[key]) : null,
    to: key in newV ? formatAuditValue(newV[key]) : null,
  }));
  Object.keys(details).forEach((key) => {
    if (keys.includes(key)) return;
    rows.push({ key: `details.${key}`, label: auditFieldLabel(key), from: null, to: formatAuditValue(details[key]) });
  });
  return rows;
};
