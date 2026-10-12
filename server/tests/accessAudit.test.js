import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';

import app from '../index';
import { pool } from '../db';
import employeeService from '../services/employeeService';
import offboardingService from '../services/offboardingService';
import auditService from '../services/auditService';

const created = { employees: [], roles: [] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

let director; // the real admin@company.com user, for service calls
let tokens = {};

const loginAs = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  expect(res.status).toBe(200);
  return res.body.data.token;
};
const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

const newLogin = async (overrides = {}) => {
  const { employee, temporaryPassword } = await employeeService.createEmployeeWithAccess(
    { name: `Audit Person ${unique()}`, email: `audit.${unique()}@company.com`, roleId: 4, ...overrides }, director,
  );
  created.employees.push(employee.id);
  return { employee, temporaryPassword };
};

const entriesFor = async (targetId, eventType) => (await pool.query(
  `SELECT * FROM access_audit WHERE target_type = 'employee' AND target_id = $1
   ${eventType ? 'AND event_type = $2' : ''} ORDER BY id`,
  eventType ? [targetId, eventType] : [targetId],
)).rows;

beforeAll(async () => {
  tokens = {
    director: await loginAs('admin@company.com'),
    admin: await loginAs('itadmin@company.com'),
    hr: await loginAs('hr@company.com'),
  };
  const me = await request(app).get('/api/auth/me').set(auth('director'));
  director = me.body.data;
});

afterAll(async () => {
  await pool.query('DELETE FROM offboarding_requests WHERE employee_id = ANY($1)', [created.employees]);
  await pool.query('DELETE FROM sessions WHERE employee_id = ANY($1)', [created.employees]);
  await pool.query("DELETE FROM access_audit WHERE target_type = 'employee' AND target_id = ANY($1)", [created.employees]);
  await pool.query("DELETE FROM access_audit WHERE target_type = 'role' AND target_id = ANY($1)", [created.roles]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
  await pool.query('DELETE FROM roles WHERE id = ANY($1)', [created.roles]);
});

describe('auditService.record', () => {
  it('never throws when writing through the pool after the fact', async () => {
    await expect(auditService.record(pool, { eventType: 'x.y', targetType: 'not-a-type' })).resolves.toBeNull();
  });

  it('throws inside a transaction, so the change it describes rolls back', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(auditService.record(client, { eventType: 'x.y', targetType: 'not-a-type' })).rejects.toThrow();
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('stores a NULL actor for users without an employee row, named System when there is no actor', async () => {
    const id = await auditService.record(pool, { eventType: 'test.system', targetType: 'system', actor: null });
    const ghost = await auditService.record(pool, { eventType: 'test.ghost', targetType: 'system', actor: { id: 999999999, name: 'Ghost' } });
    const { rows } = await pool.query('SELECT id, actor_id, actor_name FROM access_audit WHERE id = ANY($1) ORDER BY id', [[id, ghost]]);
    expect(rows).toEqual([
      { id: String(id), actor_id: null, actor_name: 'System' },
      { id: String(ghost), actor_id: null, actor_name: 'Ghost' },
    ]);
    await pool.query('DELETE FROM access_audit WHERE id = ANY($1)', [[id, ghost]]);
  });
});

describe('employee access events', () => {
  it('records creation with access, role change, reset, email change, revoke and removal', async () => {
    const { employee } = await newLogin();
    const [grantedAtCreate] = await entriesFor(employee.id, 'employee.access_granted');
    expect(grantedAtCreate.new_value).toMatchObject({ role: 'Employee', roleId: 4, method: 'password' });
    expect(grantedAtCreate.actor_id).toBe(director.id);

    const role = await request(app).patch(`/api/employees/${employee.id}/role`).set(auth('director')).send({ roleId: 3 });
    expect(role.status).toBe(200);
    const [roleChanged] = await entriesFor(employee.id, 'employee.role_changed');
    expect(roleChanged.old_value).toMatchObject({ role: 'Employee', roleId: 4 });
    expect(roleChanged.new_value).toMatchObject({ role: 'HR', roleId: 3 });
    expect(roleChanged.actor_name).toBe(director.name);
    expect(roleChanged.ip).toBeTruthy();

    const reset = await request(app).post(`/api/employees/${employee.id}/reset-password`).set(auth('director'));
    expect(reset.status).toBe(200);
    const [resetEntry] = await entriesFor(employee.id, 'employee.password_reset');
    expect(JSON.stringify(resetEntry)).not.toContain(reset.body.temporaryPassword);
    expect(JSON.stringify(resetEntry)).not.toMatch(/\$2[aby]\$/);

    const newEmail = `audit.moved.${unique()}@company.com`;
    const moved = await request(app).patch(`/api/employees/${employee.id}`).set(auth('director')).send({ email: newEmail });
    expect(moved.status).toBe(200);
    const [emailChanged] = await entriesFor(employee.id, 'employee.email_changed');
    expect(emailChanged.old_value).toEqual({ email: employee.email });
    expect(emailChanged.new_value).toEqual({ email: newEmail });

    const revoke = await request(app).post(`/api/employees/${employee.id}/revoke-access`).set(auth('director'));
    expect(revoke.status).toBe(200);
    const [revoked] = await entriesFor(employee.id, 'employee.access_revoked');
    expect(revoked.old_value).toMatchObject({ role: 'HR', hasLogin: true });

    const removed = await request(app).delete(`/api/employees/${employee.id}`).set(auth('director'));
    expect(removed.status).toBe(200);
    expect(await entriesFor(employee.id, 'employee.removed')).toHaveLength(1);
  });

  it('does not record an email change for a directory-only entry', async () => {
    const entry = await employeeService.createEmployee({ name: 'Directory Audit', email: `dir.audit.${unique()}@company.com` });
    created.employees.push(entry.id);
    await employeeService.updateEmployee(entry.id, { email: `dir.audit.moved.${unique()}@company.com` }, director);
    expect(await entriesFor(entry.id, 'employee.email_changed')).toHaveLength(0);
  });

  it('writes nothing when the change is refused', async () => {
    const { employee } = await newLogin();
    const before = (await entriesFor(employee.id)).length;
    const res = await request(app).patch(`/api/employees/${employee.id}/role`).set(auth('admin')).send({ roleId: 1 });
    expect(res.status).toBe(403);
    expect((await entriesFor(employee.id)).length).toBe(before);
  });

  it('records grant access by password and by Google', async () => {
    const plain = await employeeService.createEmployee({ name: 'Grant Audit', email: `grant.audit.${unique()}@company.com` });
    created.employees.push(plain.id);
    const res = await request(app).post(`/api/employees/${plain.id}/grant-access`).set(auth('director')).send({ roleId: 4 });
    expect(res.status).toBe(200);
    expect((await entriesFor(plain.id, 'employee.access_granted'))[0].new_value).toMatchObject({ method: 'password', role: 'Employee' });

    const google = await employeeService.createEmployee({ name: 'Google Audit', email: `google.audit.${unique()}@company.com` });
    created.employees.push(google.id);
    const g = await request(app).post(`/api/employees/${google.id}/grant-google-access`).set(auth('director'));
    expect(g.status).toBe(200);
    expect((await entriesFor(google.id, 'employee.access_granted'))[0].new_value).toMatchObject({ method: 'google' });
  });

  it('records a self-service password change with the person as actor', async () => {
    const { employee, temporaryPassword } = await newLogin();
    const login = await request(app).post('/api/auth/login').send({ email: employee.email, password: temporaryPassword });
    const res = await request(app).patch('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ currentPassword: temporaryPassword, newPassword: 'quiet-harbour-lamp-77' });
    expect(res.status).toBe(200);
    const [changed] = await entriesFor(employee.id, 'password.changed');
    expect(changed.actor_id).toBe(employee.id);
    expect(JSON.stringify(changed)).not.toContain('quiet-harbour-lamp-77');
  });

  it('records offboarding revoke and removal once each, with the acting user', async () => {
    const { employee } = await newLogin();
    const exit = await offboardingService.createRequest(director, { employeeId: employee.id, lastWorkingDate: '2026-10-08' });
    await offboardingService.completeRequest(exit.id, { revokeAccess: true, deactivateEmployee: true }, director);
    const revoked = await entriesFor(employee.id, 'employee.access_revoked');
    const removed = await entriesFor(employee.id, 'employee.removed');
    expect(revoked).toHaveLength(1);
    expect(removed).toHaveLength(1);
    expect(revoked[0].actor_id).toBe(director.id);
    expect(revoked[0].details).toMatchObject({ offboardingRequestId: exit.id });
    // The removal happens after the revoke in the same transaction, and
    // records the state it actually changed: no role, no login.
    expect(revoked[0].old_value).toMatchObject({ role: 'Employee', roleId: 4, hasLogin: true });
    expect(removed[0].old_value).toEqual({ hasLogin: false });
  });

  it('does not record a role change when the role stays the same', async () => {
    const { employee } = await newLogin();
    const same = await request(app).patch(`/api/employees/${employee.id}/role`).set(auth('director')).send({ roleId: 4 });
    expect(same.status).toBe(200);
    expect(await entriesFor(employee.id, 'employee.role_changed')).toHaveLength(0);
    const changed = await request(app).patch(`/api/employees/${employee.id}/role`).set(auth('director')).send({ roleId: 3 });
    expect(changed.status).toBe(200);
    expect(await entriesFor(employee.id, 'employee.role_changed')).toHaveLength(1);
  });
});

describe('role events', () => {
  it('records create, update (added/removed permissions, rename) and delete', async () => {
    const name = `Audit Role ${unique()}`;
    const create = await request(app).post('/api/roles').set(auth('director'))
      .send({ name, permissionKeys: ['assets:read', 'tickets:read'] });
    expect(create.status).toBe(201);
    const roleId = create.body.data.id;
    created.roles.push(roleId);
    const roleEntries = async (type) => (await pool.query(
      "SELECT * FROM access_audit WHERE target_type = 'role' AND target_id = $1 AND event_type = $2", [roleId, type],
    )).rows;

    const [createdEntry] = await roleEntries('role.created');
    expect(createdEntry.new_value).toMatchObject({ name, permissions: ['assets:read', 'tickets:read'] });

    const renamed = `${name} B`;
    const update = await request(app).put(`/api/roles/${roleId}`).set(auth('director'))
      .send({ name: renamed, permissionKeys: ['assets:read', 'categories:read'] });
    expect(update.status).toBe(200);
    const [updated] = await roleEntries('role.updated');
    expect(updated.old_value).toMatchObject({ name });
    expect(updated.new_value).toMatchObject({ name: renamed, permissionsAdded: ['categories:read'], permissionsRemoved: ['tickets:read'] });

    const del = await request(app).delete(`/api/roles/${roleId}`).set(auth('director'));
    expect(del.status).toBe(200);
    const [deleted] = await roleEntries('role.deleted');
    expect(deleted.old_value).toMatchObject({ name: renamed, permissions: ['assets:read', 'categories:read'] });
    // Only a role without holders can be deleted, so no holder count is kept.
    expect(deleted.details).toBeNull();
  });
});

describe('role.updated under concurrent edits', () => {
  it('records each edit against the permissions it actually replaced', async () => {
    const name = `Concurrent Role ${unique()}`;
    const create = await request(app).post('/api/roles').set(auth('director')).send({ name, permissionKeys: ['assets:read'] });
    expect(create.status).toBe(201);
    const roleId = create.body.data.id;
    created.roles.push(roleId);
    const [a, b] = await Promise.all([
      request(app).put(`/api/roles/${roleId}`).set(auth('director')).send({ permissionKeys: ['tickets:read'] }),
      request(app).put(`/api/roles/${roleId}`).set(auth('director')).send({ permissionKeys: ['categories:read'] }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const { rows } = await pool.query(
      "SELECT new_value FROM access_audit WHERE target_type = 'role' AND target_id = $1 AND event_type = 'role.updated' ORDER BY id",
      [roleId],
    );
    expect(rows).toHaveLength(2);
    const [first, second] = rows.map((row) => row.new_value);
    expect(first.permissionsRemoved).toEqual(['assets:read']);
    // The second edit replaced what the first one set, not the original.
    expect(second.permissionsRemoved).toEqual(first.permissionsAdded);
    await request(app).delete(`/api/roles/${roleId}`).set(auth('director'));
  });
});

describe('audit date filter', () => {
  it('treats from/to as calendar days in India, whatever the database session time zone', async () => {
    const marker = `TZ Check ${unique()}`;
    const at = ['2026-03-09T23:59:00+05:30', '2026-03-10T00:30:00+05:30', '2026-03-10T05:00:00+05:30',
      '2026-03-10T23:30:00+05:30', '2026-03-11T00:10:00+05:30'];
    const { rows: inserted } = await pool.query(`
      INSERT INTO access_audit (event_type, actor_name, target_type, target_name, created_at)
      SELECT 'test.tz', 'System', 'system', $1, ts FROM unnest($2::timestamptz[]) AS ts RETURNING id`, [marker, at]);
    const ids = inserted.map((row) => row.id);
    // The service queries through a connection whose session is in UTC.
    const client = await pool.connect();
    await client.query("SET TIME ZONE 'UTC'");
    const list = (filters) => auditService.listEntries({ q: marker, ...filters }, { executor: client });
    try {
      const { data } = await list({ from: '2026-03-10', to: '2026-03-10' });
      expect(data.map((e) => new Date(e.createdAt).toISOString()).sort()).toEqual([
        new Date(at[1]).toISOString(), new Date(at[2]).toISOString(), new Date(at[3]).toISOString(),
      ].sort());
      expect((await list({ from: '2026-03-11' })).data).toHaveLength(1);
      expect((await list({ to: '2026-03-09' })).data).toHaveLength(1);
    } finally {
      await client.query('RESET TIME ZONE');
      client.release();
      await pool.query('DELETE FROM access_audit WHERE id = ANY($1)', [ids]);
    }
  });
});

describe('data export and import events', () => {
  it('records an asset export with its row count', async () => {
    const before = (await pool.query("SELECT COALESCE(MAX(id), 0) AS id FROM access_audit")).rows[0].id;
    const res = await request(app).get('/api/assets/export').set(auth('director'));
    expect(res.status).toBe(200);
    const { rows: [entry] } = await pool.query(
      "SELECT * FROM access_audit WHERE event_type = 'data.exported' AND id > $1", [before],
    );
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM assets');
    expect(entry.details).toMatchObject({ entity: 'assets', count, format: 'xlsx' });
    expect(entry.actor_name).toBe(director.name);
    await pool.query('DELETE FROM access_audit WHERE id = $1', [entry.id]);
  });

  it('records a CSV import but not a dry run', async () => {
    const before = (await pool.query("SELECT COALESCE(MAX(id), 0) AS id FROM access_audit")).rows[0].id;
    const csv = Buffer.from('category,name\n');
    const dry = await request(app).post('/api/assets/import-csv?dryRun=true').set(auth('director')).attach('file', csv, 'empty.csv');
    expect(dry.status).toBe(200);
    const real = await request(app).post('/api/assets/import-csv').set(auth('director')).attach('file', csv, 'empty.csv');
    expect(real.status).toBe(200);
    const { rows } = await pool.query("SELECT * FROM access_audit WHERE event_type = 'data.imported' AND id > $1", [before]);
    expect(rows).toHaveLength(1);
    expect(rows[0].details).toMatchObject({ entity: 'assets', format: 'csv', count: 0, fileName: 'empty.csv' });
    await pool.query('DELETE FROM access_audit WHERE id = $1', [rows[0].id]);
  });
});

describe('GET /api/audit', () => {
  it('is for audit:read holders only (Directors by default)', async () => {
    expect((await request(app).get('/api/audit').set(auth('admin'))).status).toBe(403);
    expect((await request(app).get('/api/audit').set(auth('hr'))).status).toBe(403);
    expect((await request(app).get('/api/audit')).status).toBe(401);
    const { rows } = await pool.query("SELECT key, module, description FROM permissions WHERE key = 'audit:read'");
    expect(rows).toEqual([{ key: 'audit:read', module: 'audit', description: 'View the access history' }]);
  });

  it('lists newest first with filters and a cursor', async () => {
    const { employee } = await newLogin();
    await employeeService.updateEmployeeRole(employee.id, 3, director);
    await employeeService.resetEmployeePassword(employee.id, await bcrypt.hash('x', 4), director);

    const all = await request(app).get(`/api/audit?targetType=employee&targetId=${employee.id}`).set(auth('director'));
    expect(all.status).toBe(200);
    expect(all.body.data.map((e) => e.eventType)).toEqual([
      'employee.password_reset', 'employee.role_changed', 'employee.access_granted', 'employee.created',
    ]);
    expect(all.body.nextCursor).toBeNull();
    expect(all.body.data[0]).toEqual({
      id: expect.any(Number),
      eventType: 'employee.password_reset',
      actorId: director.id,
      actorName: director.name,
      targetType: 'employee',
      targetId: employee.id,
      targetName: employee.name,
      oldValue: null,
      newValue: null,
      details: expect.objectContaining({ email: employee.email }),
      createdAt: expect.any(String),
    });
    expect(all.body.data[0]).not.toHaveProperty('ip');

    const page1 = await request(app).get(`/api/audit?targetId=${employee.id}&limit=2`).set(auth('director'));
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.nextCursor).toBe(page1.body.data[1].id);
    const page2 = await request(app).get(`/api/audit?targetId=${employee.id}&limit=2&before=${page1.body.nextCursor}`).set(auth('director'));
    expect(page2.body.data.map((e) => e.eventType)).toEqual(['employee.access_granted', 'employee.created']);
    expect(page2.body.nextCursor).toBeNull();

    const prefix = await request(app).get(`/api/audit?targetId=${employee.id}&eventType=employee.`).set(auth('director'));
    expect(prefix.body.data).toHaveLength(4);
    const exact = await request(app).get(`/api/audit?targetId=${employee.id}&eventType=employee.role_changed`).set(auth('director'));
    expect(exact.body.data.map((e) => e.eventType)).toEqual(['employee.role_changed']);
    const list = await request(app)
      .get(`/api/audit?targetId=${employee.id}&eventType=employee.role_changed,employee.password_reset,role.`)
      .set(auth('director'));
    expect(list.body.data.map((e) => e.eventType)).toEqual(['employee.password_reset', 'employee.role_changed']);

    const byName = await request(app).get(`/api/audit?q=${encodeURIComponent(employee.name)}`).set(auth('director'));
    expect(byName.body.data.every((e) => e.targetName === employee.name || e.actorName === employee.name)).toBe(true);
    expect(byName.body.data.length).toBeGreaterThanOrEqual(3);

    const byActor = await request(app).get(`/api/audit?actorId=${director.id}&targetId=${employee.id}`).set(auth('director'));
    expect(byActor.body.data).toHaveLength(4);

    const future = await request(app).get(`/api/audit?targetId=${employee.id}&from=2999-01-01`).set(auth('director'));
    expect(future.body.data).toHaveLength(0);
    const upTo = await request(app).get(`/api/audit?targetId=${employee.id}&from=2000-01-01&to=2999-12-31`).set(auth('director'));
    expect(upTo.body.data).toHaveLength(4);
  });

  it('rejects repeated and malformed parameters', async () => {
    const bad = async (qs) => (await request(app).get(`/api/audit?${qs}`).set(auth('director'))).status;
    expect(await bad('q=a&q=b')).toBe(400);
    expect(await bad('from=2026-13-01')).toBe(400);
    expect(await bad('from=08-10-2026')).toBe(400);
    expect(await bad('from=2026-10-09&to=2026-10-01')).toBe(400);
    expect(await bad('targetType=asset')).toBe(400);
    expect(await bad('limit=0')).toBe(400);
    expect(await bad('before=abc')).toBe(400);
    expect(await bad('eventType=DROP%20TABLE')).toBe(400);
    // Above the maximum is capped, not rejected.
    const capped = await request(app).get('/api/audit?limit=1000').set(auth('director'));
    expect(capped.status).toBe(200);
    expect(capped.body.data.length).toBeLessThanOrEqual(200);
  });
});

describe('request IP stays private', () => {
  it('is not part of /api/auth/me', async () => {
    const me = await request(app).get('/api/auth/me').set(auth('director'));
    expect(me.body.data).not.toHaveProperty('ip');
  });
});

describe('important changes beyond access', () => {
  it('records who added a person to the directory, with and without a login', async () => {
    const plain = await employeeService.createEmployee(
      { name: `Audit Plain ${unique()}`, email: `audit.plain.${unique()}@company.com`, department: 'IT', workMode: 'remote' },
      director,
    );
    created.employees.push(plain.id);
    const [createdEntry] = await entriesFor(plain.id, 'employee.created');
    expect(createdEntry.actor_name).toBe(director.name);
    expect(createdEntry.new_value).toMatchObject({ department: 'IT', workMode: 'remote' });
    expect(createdEntry.details).toMatchObject({ withLogin: false });

    const { employee } = await newLogin();
    expect(await entriesFor(employee.id, 'employee.created')).toHaveLength(1);
    expect(await entriesFor(employee.id, 'employee.access_granted')).toHaveLength(1);
  });

  it('records an exit from start to completion, with what happened', async () => {
    const assetService = await import('../services/assetService');
    const { employee } = await newLogin();
    const asset = await assetService.createAsset({ name: 'Audit Exit Laptop', serialNumber: `AUD-${unique()}`, categoryId: 1 });
    try {
      await assetService.assignAsset(asset.id, employee.id, null, null);
      const exit = await offboardingService.createRequest(director, { employeeId: employee.id, lastWorkingDate: '2026-10-20' });
      const [started] = await entriesFor(employee.id, 'offboarding.started');
      expect(started.new_value).toMatchObject({ lastWorkingDate: '2026-10-20' });
      expect(started.details).toMatchObject({ assetsToCollect: 1, offboardingRequestId: exit.id });

      await offboardingService.resolveItem(exit.id, exit.items[0].id, { outcome: 'missing' }, director);
      await offboardingService.completeRequest(exit.id, {}, director);
      const [completed] = await entriesFor(employee.id, 'offboarding.completed');
      expect(completed.details).toMatchObject({ revokedAccess: true, returned: 0, missing: 1, removedFromDirectory: false });

      const other = await newLogin();
      const second = await offboardingService.createRequest(director, { employeeId: other.employee.id, lastWorkingDate: '2026-10-21' });
      await offboardingService.cancelRequest(second.id, director);
      const [cancelled] = await entriesFor(other.employee.id, 'offboarding.cancelled');
      expect(cancelled.actor_name).toBe(director.name);
      await pool.query('DELETE FROM offboarding_requests WHERE id = ANY($1)', [[exit.id, second.id]]);
    } finally {
      await pool.query('UPDATE assets SET parent_id = NULL WHERE id = $1', [asset.id]).catch(() => {});
      await pool.query('DELETE FROM assets WHERE id = $1', [asset.id]);
    }
  });

  it('records permanent deletions of assets and bulk items', async () => {
    const assetService = await import('../services/assetService');
    const stockService = (await import('../services/stockService')).default ?? await import('../services/stockService');
    const asset = await assetService.createAsset({ name: 'Audit Doomed Asset', serialNumber: `AUD-DEL-${unique()}`, categoryId: 1 });
    await assetService.deleteAsset(asset.id, true, director);
    const { rows: [assetEntry] } = await pool.query(
      "SELECT * FROM access_audit WHERE event_type = 'asset.deleted' ORDER BY id DESC LIMIT 1"
    );
    expect(assetEntry.target_name).toContain('Audit Doomed Asset');
    expect(assetEntry.details).toMatchObject({ assetId: asset.id, serialNumber: asset.serialNumber });
    expect(assetEntry.actor_name).toBe(director.name);

    const item = await stockService.createItem({ name: `Audit Doomed Bag ${unique()}`, quantity: 3 }, director);
    await stockService.deleteItem(item.id, director);
    const { rows: [stockEntry] } = await pool.query(
      "SELECT * FROM access_audit WHERE event_type = 'stock.deleted' ORDER BY id DESC LIMIT 1"
    );
    expect(stockEntry.details).toMatchObject({ stockItemId: item.id, totalQuantity: 3 });
    await pool.query("DELETE FROM access_audit WHERE event_type IN ('asset.deleted', 'stock.deleted') AND id = ANY($1)", [[assetEntry.id, stockEntry.id]]);
    await pool.query('DELETE FROM stock_history WHERE stock_item_id = $1', [item.id]);
    await pool.query('DELETE FROM stock_items WHERE id = $1', [item.id]);
  });
});

