import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';
import employeeService from '../services/employeeService';

// The read-only feed for the People Portal: off without a key, refuses a
// wrong key, and returns who holds what (accessories under their laptop)
// without costs or admin notes.
const KEY = 'test-people-portal-key-0123456789abcdef';
const created = { assets: [], employees: [] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const feed = (key = KEY) => request(app).get('/api/integration/v1/assignments').set('X-Integration-Key', key);
let holder;

const newAsset = async (fields) => {
  const asset = await assetService.createAsset({ categoryId: 1, serialNumber: `PPL-${unique()}`, ...fields });
  created.assets.push(asset.id);
  return asset;
};

beforeAll(async () => {
  holder = await employeeService.createEmployee({ name: 'Feed Test Person', email: `Feed.${unique()}@company.com` });
  created.employees.push(holder.id);
});
afterEach(() => { delete process.env.PEOPLE_PORTAL_API_KEY; });
afterAll(async () => {
  await pool.query('UPDATE assets SET parent_id = NULL WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
});

describe('People Portal feed', () => {
  it('does not exist until a key is configured', async () => {
    expect((await feed()).status).toBe(404);
    process.env.PEOPLE_PORTAL_API_KEY = 'too-short';
    expect((await feed('too-short')).status).toBe(404);
  });

  it('refuses a missing or wrong key, and a user session is not enough', async () => {
    process.env.PEOPLE_PORTAL_API_KEY = KEY;
    expect((await request(app).get('/api/integration/v1/assignments')).status).toBe(401);
    expect((await feed(`${KEY}x`)).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@company.com', password: 'password' });
    const withSession = await request(app).get('/api/integration/v1/assignments').set('Authorization', `Bearer ${login.body.data.token}`);
    expect(withSession.status).toBe(401);
    expect((await request(app).get('/api/integration/v1/ping').set('X-Integration-Key', KEY)).body.data.ok).toBe(true);
  });

  it('returns held assets by email with accessories nested, and no cost or notes', async () => {
    process.env.PEOPLE_PORTAL_API_KEY = KEY;
    const laptop = await newAsset({ name: 'Feed Laptop', costCents: 9900000, notes: 'internal remark', warrantyExpiryDate: '2028-03-31' });
    const charger = await newAsset({ name: 'Feed Charger', parentId: laptop.id });
    const retired = await newAsset({ name: 'Feed Old Mouse' });
    await assetService.assignAsset(laptop.id, holder.id, null, null);
    await assetService.assignAsset(retired.id, holder.id, null, null);
    await assetService.retireAsset(retired.id, null, true);

    const res = await feed();
    expect(res.status).toBe(200);
    const email = holder.email.toLowerCase();
    expect(res.body.data.employees.some((e) => e.email === email)).toBe(true);
    const mine = res.body.data.assets.filter((a) => a.email === email);
    expect(mine.map((a) => a.name)).toEqual(['Feed Laptop']);
    expect(mine[0].accessories).toEqual([{ name: 'Feed Charger', serialNumber: charger.serialNumber }]);
    expect(mine[0].warrantyExpiryDate).toBe('2028-03-31');
    expect(mine[0]).not.toHaveProperty('costCents');
    expect(mine[0]).not.toHaveProperty('notes');
  });

  it('leaves out removed employees', async () => {
    process.env.PEOPLE_PORTAL_API_KEY = KEY;
    const gone = await employeeService.createEmployee({ name: 'Feed Gone', email: `feed.gone.${unique()}@company.com` });
    created.employees.push(gone.id);
    await pool.query('UPDATE employees SET deleted_at = NOW() WHERE id = $1', [gone.id]);
    const res = await feed();
    expect(res.body.data.employees.some((e) => e.email === gone.email.toLowerCase())).toBe(false);
  });
});
