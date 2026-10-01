import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';
import employeeService from '../services/employeeService';
import offboardingService from '../services/offboardingService';

const created = { assets: [], employees: [] };
const director = { id: null, role: 'director', isDirector: true, permissions: ['*'] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const LAST_DAY = '2026-10-15';

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  return { Authorization: `Bearer ${res.body.data.token}` };
};

beforeAll(async () => {
  director.id = (await pool.query("SELECT id FROM employees WHERE email = 'admin@company.com'")).rows[0].id;
});
afterAll(async () => {
  await pool.query('DELETE FROM offboarding_requests WHERE employee_id = ANY($1)', [created.employees]);
  await pool.query('UPDATE assets SET parent_id = NULL WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM sessions WHERE employee_id = ANY($1)', [created.employees]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
});

const newAsset = async (extra = {}) => {
  const asset = await assetService.createAsset({
    name: 'Exit Test Asset', serialNumber: `EXIT-${unique()}`, categoryId: 1, status: 'available', ...extra,
  });
  created.assets.push(asset.id);
  return asset;
};
const newLeaver = async ({ withLogin = true } = {}) => {
  const data = { name: 'Exit Test Person', email: `exit.${unique()}@company.com`, roleId: 4 };
  const employee = withLogin
    ? (await employeeService.createEmployeeWithAccess(data, director)).employee
    : await employeeService.createEmployee(data);
  created.employees.push(employee.id);
  return employee;
};

describe('offboarding workflow', () => {
  it('lists every held asset, returns them, and completes with access revoked', async () => {
    const leaver = await newLeaver();
    const laptop = await newAsset({ name: 'Exit Laptop' });
    const charger = await newAsset({ name: 'Exit Charger', parentId: laptop.id });
    const phone = await newAsset({ name: 'Exit Phone' });
    await assetService.assignAsset(laptop.id, leaver.id, null, null);
    await assetService.assignAsset(phone.id, leaver.id, null, null);

    const hr = await login('hr@company.com');
    const start = await request(app).post('/api/offboarding').set(hr)
      .send({ employeeId: leaver.id, lastWorkingDate: LAST_DAY, reason: 'resignation' });
    expect(start.status).toBe(201);
    const offboarding = start.body.data;
    expect(offboarding.items.map((i) => i.assetId).sort()).toEqual([laptop.id, charger.id, phone.id].sort());

    // A second open exit for the same person is refused.
    const again = await request(app).post('/api/offboarding').set(hr)
      .send({ employeeId: leaver.id, lastWorkingDate: LAST_DAY });
    expect(again.status).toBe(409);

    // HR cannot collect hardware, and cannot complete while assets are out.
    const laptopItem = offboarding.items.find((i) => i.assetId === laptop.id);
    expect((await request(app).patch(`/api/offboarding/${offboarding.id}/items/${laptopItem.id}`).set(hr)
      .send({ outcome: 'returned' })).status).toBe(403);
    expect((await request(app).post(`/api/offboarding/${offboarding.id}/complete`).set(hr).send({})).status).toBe(409);

    // IT returns the laptop; its charger comes back with it.
    const it = await login('itadmin@company.com');
    const afterLaptop = await request(app).patch(`/api/offboarding/${offboarding.id}/items/${laptopItem.id}`).set(it)
      .send({ outcome: 'returned', condition: 'damaged', notes: 'cracked hinge' });
    expect(afterLaptop.status).toBe(200);
    expect(afterLaptop.body.data.status).toBe('in_progress');
    const byAsset = Object.fromEntries(afterLaptop.body.data.items.map((i) => [i.assetId, i]));
    expect(byAsset[laptop.id]).toMatchObject({ status: 'returned', condition: 'damaged' });
    expect(byAsset[charger.id].status).toBe('returned');
    expect((await assetService.getAssetById(laptop.id)).status).toBe('available');
    expect((await assetService.getAssetById(charger.id)).status).toBe('available');

    // The phone is lost: it is retired, not returned to stock.
    await request(app).patch(`/api/offboarding/${offboarding.id}/items/${byAsset[phone.id].id}`).set(it)
      .send({ outcome: 'missing', notes: 'not handed in' }).expect(200);
    expect((await assetService.getAssetById(phone.id)).status).toBe('retired');

    // Employees list shows the open exit.
    const list = await employeeService.getEmployees({ q: leaver.email });
    expect(list[0].offboarding).toMatchObject({ id: offboarding.id, lastWorkingDate: LAST_DAY });

    const done = await request(app).post(`/api/offboarding/${offboarding.id}/complete`).set(it).send({});
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('completed');
    expect((await employeeService.getEmployeeById(leaver.id)).hasLogin).toBe(false);
    expect((await employeeService.getEmployees({ q: leaver.email }))[0].offboarding).toBeNull();
  });

  it('picks up assets assigned or returned outside the checklist', async () => {
    const leaver = await newLeaver({ withLogin: false });
    const first = await newAsset();
    await assetService.assignAsset(first.id, leaver.id, null, null);
    const offboarding = await offboardingService.createRequest(director, { employeeId: leaver.id, lastWorkingDate: LAST_DAY });
    expect(offboarding.items).toHaveLength(1);

    const second = await newAsset();
    await assetService.assignAsset(second.id, leaver.id, null, null);
    await assetService.returnAsset(first.id, 'Returned at the desk');

    const fresh = await offboardingService.getRequestById(offboarding.id);
    const byAsset = Object.fromEntries(fresh.items.map((i) => [i.assetId, i]));
    expect(byAsset[first.id].status).toBe('returned');
    expect(byAsset[second.id].status).toBe('pending');
    await expect(offboardingService.completeRequest(offboarding.id, {}, director)).rejects.toMatchObject({ statusCode: 409 });

    await offboardingService.resolveItem(offboarding.id, byAsset[second.id].id, { outcome: 'returned' }, director);
    const done = await offboardingService.completeRequest(offboarding.id, { deactivateEmployee: true }, director);
    expect(done.status).toBe('completed');
    expect((await employeeService.getEmployeeById(leaver.id)).deletedAt).not.toBeNull();
  });

  it('can be cancelled, after which it is read-only and a new one can start', async () => {
    const leaver = await newLeaver({ withLogin: false });
    const offboarding = await offboardingService.createRequest(director, { employeeId: leaver.id, lastWorkingDate: LAST_DAY });
    expect(offboarding.items).toHaveLength(0);
    await offboardingService.cancelRequest(offboarding.id);
    await expect(offboardingService.updateRequest(offboarding.id, { notes: 'x' })).rejects.toMatchObject({ statusCode: 409 });
    const next = await offboardingService.createRequest(director, { employeeId: leaver.id, lastWorkingDate: LAST_DAY });
    expect(next.status).toBe('pending');
  });

  it('keeps the last Director: completing with revoke is refused and nothing is marked complete', async () => {
    const others = (await pool.query(
      "SELECT id FROM employees WHERE role_id = 1 AND deleted_at IS NULL AND email <> 'admin@company.com'"
    )).rows.map((row) => row.id);
    const it = { id: (await pool.query("SELECT id FROM employees WHERE email = 'itadmin@company.com'")).rows[0].id,
      role: 'admin', roleId: 2, permissions: ['offboarding:update', 'employees:grant-access'] };
    await pool.query('UPDATE employees SET deleted_at = NOW() WHERE id = ANY($1)', [others]);
    let offboarding;
    try {
      offboarding = await offboardingService.createRequest(it, { employeeId: director.id, lastWorkingDate: LAST_DAY });
      // Another Director (by role) completes it; revoking the last one is refused.
      const otherDirector = { id: it.id, role: 'director', isDirector: true, permissions: ['*'] };
      await expect(offboardingService.completeRequest(offboarding.id, {}, otherDirector)).rejects.toMatchObject({ statusCode: 409 });
      expect((await offboardingService.getRequestById(offboarding.id)).status).not.toBe('completed');
    } finally {
      if (offboarding) await pool.query('DELETE FROM offboarding_requests WHERE id = $1', [offboarding.id]);
      await pool.query('UPDATE employees SET deleted_at = NULL WHERE id = ANY($1)', [others]);
    }
  });

  it('does not let someone start their own exit or employees see exits', async () => {
    await expect(offboardingService.createRequest(director, { employeeId: director.id, lastWorkingDate: LAST_DAY }))
      .rejects.toMatchObject({ statusCode: 400 });
    const employee = await login('employee@company.com');
    expect((await request(app).get('/api/offboarding').set(employee)).status).toBe(403);
    const hr = await login('hr@company.com');
    expect((await request(app).post('/api/offboarding').set(hr)
      .send({ employeeId: director.id, lastWorkingDate: '15/10/2026' })).status).toBe(400);
  });

  it('never lets the leaver change their own exit', async () => {
    const leaver = await newLeaver({ withLogin: false });
    const asset = await newAsset();
    await assetService.assignAsset(asset.id, leaver.id, null, null);
    const offboarding = await offboardingService.createRequest(director, { employeeId: leaver.id, lastWorkingDate: LAST_DAY });
    const self = { id: leaver.id, role: 'admin', permissions: ['offboarding:update', 'offboarding:collect', 'assets:assign', 'assets:delete'] };
    await expect(offboardingService.updateRequest(offboarding.id, { notes: 'x' }, self)).rejects.toMatchObject({ statusCode: 403 });
    await expect(offboardingService.cancelRequest(offboarding.id, self)).rejects.toMatchObject({ statusCode: 403 });
    await expect(offboardingService.resolveItem(offboarding.id, offboarding.items[0].id, { outcome: 'returned' }, self))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(offboardingService.completeRequest(offboarding.id, {}, self)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('needs the same rights as Inventory to return or write off an asset', async () => {
    const leaver = await newLeaver({ withLogin: false });
    const asset = await newAsset();
    await assetService.assignAsset(asset.id, leaver.id, null, null);
    const offboarding = await offboardingService.createRequest(director, { employeeId: leaver.id, lastWorkingDate: LAST_DAY });
    const collector = { id: director.id + 100000, role: 'admin', roleId: 99, permissions: ['offboarding:collect', 'assets:assign'] };
    await expect(offboardingService.resolveItem(offboarding.id, offboarding.items[0].id, { outcome: 'missing' }, collector))
      .rejects.toMatchObject({ statusCode: 403 });
    const remover = { id: director.id + 100000, role: 'hr', roleId: 99, permissions: ['offboarding:update'] };
    await offboardingService.resolveItem(offboarding.id, offboarding.items[0].id, { outcome: 'returned' }, director);
    await expect(offboardingService.completeRequest(offboarding.id, { deactivateEmployee: true }, remover))
      .rejects.toMatchObject({ statusCode: 403 });
    expect((await offboardingService.getRequestById(offboarding.id)).status).toBe('in_progress');
  });

  it('records an asset retired from Inventory as missing, and refuses to act on a reassigned asset', async () => {
    const leaver = await newLeaver({ withLogin: false });
    const colleague = await newLeaver({ withLogin: false });
    const [lost, moved] = [await newAsset(), await newAsset()];
    await assetService.assignAsset(lost.id, leaver.id, null, null);
    await assetService.assignAsset(moved.id, leaver.id, null, null);
    const offboarding = await offboardingService.createRequest(director, { employeeId: leaver.id, lastWorkingDate: LAST_DAY });
    const itemFor = (assetId) => offboarding.items.find((i) => i.assetId === assetId);

    await assetService.retireAsset(lost.id, 'Lost', true);
    // Reassigned straight to a colleague: it must not be taken back from them.
    await assetService.assignAsset(moved.id, colleague.id, null, null, null, { reassign: true });
    await expect(offboardingService.resolveItem(offboarding.id, itemFor(moved.id).id, { outcome: 'missing' }, director))
      .rejects.toMatchObject({ statusCode: 409 });
    expect((await assetService.getAssetById(moved.id)).assignedTo).toBe(colleague.id);

    const fresh = await offboardingService.getRequestById(offboarding.id);
    const byAsset = Object.fromEntries(fresh.items.map((i) => [i.assetId, i]));
    expect(byAsset[lost.id].status).toBe('missing');
    expect(byAsset[moved.id].status).toBe('returned');
    expect(fresh.pendingItems).toBe(0);
  });

  it('counts live holdings in the list, before anyone opens the checklist', async () => {
    const leaver = await newLeaver({ withLogin: false });
    const asset = await newAsset();
    await assetService.assignAsset(asset.id, leaver.id, null, null);
    const offboarding = await offboardingService.createRequest(director, { employeeId: leaver.id, lastWorkingDate: LAST_DAY });
    await assetService.returnAsset(asset.id, 'At the desk');
    const [row] = await offboardingService.getRequests({ employeeId: leaver.id, status: 'open' });
    expect(row).toMatchObject({ id: offboarding.id, pendingItems: 0, totalItems: 1 });
  });
});
