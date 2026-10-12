import request from 'supertest';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';
import employeeService from '../services/employeeService';

const created = { assets: [], employees: [], categories: [] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
let auth = {};

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  expect(res.status).toBe(200);
  return { Authorization: `Bearer ${res.body.data.token}` };
};

const newAsset = async (extra = {}) => {
  const asset = await assetService.createAsset({
    name: 'Bulk Test Asset', serialNumber: `BULK-${unique()}`, categoryId: 1, status: 'available', ...extra,
  });
  created.assets.push(asset.id);
  return asset;
};
const newPerson = async () => {
  const employee = await employeeService.createEmployee({ name: 'Bulk Test Person', email: `bulk.${unique()}@company.com` });
  created.employees.push(employee.id);
  return employee;
};
const statusOf = async (id) => (await pool.query('SELECT status, assigned_to, location, category_id FROM assets WHERE id = $1', [id])).rows[0];
const historyOf = async (id, eventType) => (await pool.query(
  'SELECT * FROM asset_history WHERE asset_id = $1 AND event_type = $2 ORDER BY id', [id, eventType],
)).rows;

beforeAll(async () => {
  auth = {
    director: await login('admin@company.com'),
    admin: await login('itadmin@company.com'),
    hr: await login('hr@company.com'),
    employee: await login('employee@company.com'),
  };
});

afterAll(async () => {
  await pool.query('UPDATE assets SET parent_id = NULL WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
  await pool.query('DELETE FROM categories WHERE id = ANY($1)', [created.categories]);
});

describe('bulk action validation', () => {
  const endpoints = [
    ['/api/assets/bulk/assign', { employeeId: 1 }],
    ['/api/assets/bulk/return', {}],
    ['/api/assets/bulk/update', { changes: { location: 'Pune' } }],
  ];

  it.each(endpoints)('%s rejects bad id lists', async (url, extra) => {
    const post = (assetIds) => request(app).post(url).set(auth.admin).send({ assetIds, ...extra });
    expect((await post(undefined)).status).toBe(400);
    expect((await post([])).status).toBe(400);
    expect((await post([1, 1])).status).toBe(400);
    expect((await post([0])).status).toBe(400);
    expect((await post([-3])).status).toBe(400);
    expect((await post([1.5])).status).toBe(400);
    expect((await post(['abc'])).status).toBe(400);
    expect((await post('1,2')).status).toBe(400);
    expect((await post(Array.from({ length: 201 }, (_, i) => i + 1))).status).toBe(400);
  });

  it('needs assets:assign / assets:update', async () => {
    const asset = await newAsset();
    for (const who of ['hr', 'employee']) {
      expect((await request(app).post('/api/assets/bulk/assign').set(auth[who]).send({ assetIds: [asset.id], employeeId: 1 })).status).toBe(403);
      expect((await request(app).post('/api/assets/bulk/return').set(auth[who]).send({ assetIds: [asset.id] })).status).toBe(403);
      expect((await request(app).post('/api/assets/bulk/update').set(auth[who]).send({ assetIds: [asset.id], changes: { location: 'X' } })).status).toBe(403);
    }
    expect((await request(app).post('/api/assets/bulk/return').send({ assetIds: [asset.id] })).status).toBe(401);
  });
});

describe('POST /api/assets/bulk/assign', () => {
  it('assigns every selected available company asset, with history for each', async () => {
    const person = await newPerson();
    const a = await newAsset();
    const b = await newAsset();
    const charger = await newAsset({ parentId: a.id });
    const res = await request(app).post('/api/assets/bulk/assign').set(auth.admin)
      .send({ assetIds: [b.id, a.id], employeeId: person.id, note: 'Desk move' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ assigned: 2 });
    for (const id of [a.id, b.id, charger.id]) {
      expect(await statusOf(id)).toMatchObject({ status: 'in-use', assigned_to: person.id });
    }
    expect((await historyOf(a.id, 'assigned'))[0].note).toBe('Desk move');
    expect(await historyOf(b.id, 'assigned')).toHaveLength(1);
  });

  it('is all or nothing: a client-owned or in-use asset fails the batch', async () => {
    const person = await newPerson();
    const free = await newAsset();
    const client = await newAsset({ assetType: 'client' });
    const res = await request(app).post('/api/assets/bulk/assign').set(auth.admin)
      .send({ assetIds: [free.id, client.id], employeeId: person.id });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/client-owned/);
    expect((await statusOf(free.id)).status).toBe('available');

    const busy = await newAsset();
    await assetService.assignAsset(busy.id, (await newPerson()).id, null, null);
    const res2 = await request(app).post('/api/assets/bulk/assign').set(auth.admin)
      .send({ assetIds: [free.id, busy.id], employeeId: person.id });
    expect(res2.status).toBe(409);
    expect((await statusOf(free.id)).status).toBe('available');

    expect((await request(app).post('/api/assets/bulk/assign').set(auth.admin)
      .send({ assetIds: [free.id], employeeId: 2147483000 })).status).toBe(404);
    expect((await request(app).post('/api/assets/bulk/assign').set(auth.admin)
      .send({ assetIds: [free.id] })).status).toBe(400);
  });
});

describe('POST /api/assets/bulk/return', () => {
  it('returns in-use assets (client-owned back to the client), skipping the rest', async () => {
    const person = await newPerson();
    const laptop = await newAsset({ name: 'Bulk Laptop' });
    const charger = await newAsset({ name: 'Bulk Charger', parentId: laptop.id });
    const loanerOnly = await newAsset({ name: 'Bulk Mouse' });
    const clientBox = await newAsset({ name: 'Bulk Client Box', assetType: 'client' });
    const idle = await newAsset({ name: 'Bulk Idle' });
    await assetService.assignAsset(laptop.id, person.id, null, null);
    await assetService.assignAsset(loanerOnly.id, person.id, null, null);
    await assetService.assignAsset(clientBox.id, person.id, null, null);

    const res = await request(app).post('/api/assets/bulk/return').set(auth.admin)
      .send({ assetIds: [laptop.id, charger.id, clientBox.id, idle.id], note: 'Bulk return' });
    expect(res.status).toBe(200);
    // The charger came back with its laptop and counts as returned.
    expect(res.body.data).toEqual({
      returned: 3,
      skipped: [{ id: idle.id, name: 'Bulk Idle', reason: 'Not in use (status: available)' }],
    });
    expect(await statusOf(laptop.id)).toMatchObject({ status: 'available', assigned_to: null });
    expect(await statusOf(charger.id)).toMatchObject({ status: 'available', assigned_to: null });
    expect(await statusOf(clientBox.id)).toMatchObject({ status: 'returned', assigned_to: null });
    expect(await statusOf(loanerOnly.id)).toMatchObject({ status: 'in-use' });
    expect((await historyOf(laptop.id, 'returned'))[0]).toMatchObject({ note: 'Bulk return', employee_id: person.id });
    expect(await historyOf(charger.id, 'returned')).toHaveLength(1);

    const missing = await request(app).post('/api/assets/bulk/return').set(auth.admin).send({ assetIds: [2147483000] });
    expect(missing.status).toBe(200);
    expect(missing.body.data).toEqual({ returned: 0, skipped: [{ id: 2147483000, name: null, reason: 'Asset not found' }] });
  });
});

describe('POST /api/assets/bulk/update', () => {
  it('sets location and category on every asset with a history entry each', async () => {
    const { rows: [category] } = await pool.query(
      "INSERT INTO categories (name, badge_char, color) VALUES ($1, 'B', '#123456') RETURNING id, name", [`Bulk Cat ${unique()}`],
    );
    created.categories.push(category.id);
    const a = await newAsset({ location: 'Pune' });
    const b = await newAsset();
    const res = await request(app).post('/api/assets/bulk/update').set(auth.admin)
      .send({ assetIds: [a.id, b.id], changes: { location: '  Bangalore ', categoryId: category.id } });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 2 });
    expect(await statusOf(a.id)).toMatchObject({ location: 'Bangalore', category_id: category.id });
    expect(await statusOf(b.id)).toMatchObject({ location: 'Bangalore', category_id: category.id });
    const [entry] = await historyOf(a.id, 'updated');
    expect(entry.note).toContain('location: Pune → Bangalore');
    expect(entry.note).toContain(`→ ${category.name}`);

    // Only the given field changes; null clears.
    const cleared = await request(app).post('/api/assets/bulk/update').set(auth.admin)
      .send({ assetIds: [a.id], changes: { location: null } });
    expect(cleared.status).toBe(200);
    expect(await statusOf(a.id)).toMatchObject({ location: null, category_id: category.id });
  });

  it('rejects empty, unknown or invalid changes and retired assets', async () => {
    const a = await newAsset({ location: 'Pune' });
    const post = (changes, assetIds = [a.id]) => request(app).post('/api/assets/bulk/update').set(auth.admin).send({ assetIds, changes });
    expect((await post(undefined)).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ name: 'x' })).status).toBe(400);
    expect((await post({ location: 'x'.repeat(101) })).status).toBe(400);
    expect((await post({ location: 5 })).status).toBe(400);
    expect((await post({ categoryId: 'abc' })).status).toBe(400);
    const noCategory = await post({ categoryId: 2147483000 });
    expect(noCategory.status).toBe(400);
    expect(noCategory.body.message).toMatch(/Category not found/);

    const retired = await newAsset();
    await assetService.retireAsset(retired.id, null, true);
    expect((await post({ location: 'Delhi' }, [a.id, retired.id])).status).toBe(400);
    expect((await post({ location: 'Delhi' }, [a.id, 2147483000])).status).toBe(404);
    expect((await statusOf(a.id)).location).toBe('Pune');
  });
});

describe('GET /api/assets/export?ids=', () => {
  const download = (query, who = 'admin') => request(app).get('/api/assets/export').query(query).set(auth[who])
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });
  const dataRows = async (buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const serials = [];
    workbook.eachSheet((sheet) => {
      const header = sheet.getRow(1).values;
      const column = header.indexOf('Serial Number');
      sheet.eachRow((row, n) => { if (n > 1) serials.push(row.getCell(column).value); });
    });
    return serials;
  };

  it('exports only the selected assets and records the selection size', async () => {
    const laptop = await newAsset({ name: 'Export Laptop' });
    const clientBox = await newAsset({ name: 'Export Client', assetType: 'client' });
    await newAsset({ name: 'Not Selected' });
    const before = (await pool.query('SELECT COALESCE(MAX(id), 0) AS id FROM access_audit')).rows[0].id;

    const res = await download({ ids: `${laptop.id}, ${clientBox.id},${laptop.id}` });
    expect(res.status).toBe(200);
    expect((await dataRows(res.body)).sort()).toEqual([laptop.serialNumber, clientBox.serialNumber].sort());

    const { rows: [entry] } = await pool.query(
      "SELECT * FROM access_audit WHERE event_type = 'data.exported' AND id > $1", [before],
    );
    expect(entry.details).toMatchObject({ entity: 'assets', count: 2, filters: { ids: 2 } });
    await pool.query('DELETE FROM access_audit WHERE id = $1', [entry.id]);
  });

  it('rejects malformed or repeated ids and still needs assets:export', async () => {
    expect((await download({ ids: 'abc' })).status).toBe(400);
    expect((await download({ ids: '1,,2' })).status).toBe(400);
    expect((await download({ ids: '' })).status).toBe(400);
    expect((await request(app).get('/api/assets/export?ids=1&ids=2').set(auth.admin)).status).toBe(400);
    expect((await download({ ids: '1' }, 'hr')).status).toBe(403);
  });

  it('assigns a laptop and its charger selected together (the charger comes with the laptop)', async () => {
    const dir = await login('admin@company.com');
    const person = await newPerson();
    const laptop = await newAsset({ name: 'Bulk Parent Laptop' });
    const charger = await newAsset({ name: 'Bulk Child Charger', parentId: laptop.id });
    const res = await request(app).post('/api/assets/bulk/assign').set(dir)
      .send({ assetIds: [laptop.id, charger.id], employeeId: person.id });
    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toBe(2);
    for (const id of [laptop.id, charger.id]) {
      expect(await assetService.getAssetById(id)).toMatchObject({ status: 'in-use', assignedTo: person.id });
    }
  });

  it("never hands out a client-owned accessory selected together with its company parent", async () => {
    const dir = await login('admin@company.com');
    const person = await newPerson();
    const laptop = await newAsset({ name: 'Company Parent' });
    const clientCharger = await newAsset({ name: 'Client Charger', parentId: laptop.id, assetType: 'client', clientName: 'Acme' });
    const res = await request(app).post('/api/assets/bulk/assign').set(dir)
      .send({ assetIds: [laptop.id, clientCharger.id], employeeId: person.id });
    expect(res.status).toBe(409);
    expect((await statusOf(laptop.id)).status).toBe('available');
    expect((await statusOf(clientCharger.id)).status).toBe('available');
  });

  it('runs overlapping bulk and single actions without deadlocking', async () => {
    const dir = await login('admin@company.com');
    const [p1, p2] = [await newPerson(), await newPerson()];
    const parent = await newAsset({ name: 'Lock Parent' });
    const child = await newAsset({ name: 'Lock Child', parentId: parent.id });
    const other = await newAsset({ name: 'Lock Other' });
    await assetService.assignAsset(parent.id, p1.id, null, null);
    // Return everything in bulk while a single return of the parent runs.
    const results = await Promise.allSettled([
      request(app).post('/api/assets/bulk/return').set(dir).send({ assetIds: [child.id, parent.id, other.id] }),
      request(app).post(`/api/assets/${parent.id}/return`).set(dir).send({}),
    ]);
    for (const r of results) {
      expect(r.status).toBe('fulfilled');
      expect(r.value.status).not.toBe(500);
    }
    expect((await statusOf(parent.id)).status).toBe('available');
    expect((await statusOf(child.id)).status).toBe('available');
    void p2;
  });
});

