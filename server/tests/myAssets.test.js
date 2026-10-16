import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';

// An employee's own asset list: specs and accessories for everything, the
// price only for client assets (company prices stay hidden from them).
const created = [];
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const headers = {};
let me;

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  return { Authorization: `Bearer ${res.body.data.token}` };
};
const newAsset = async (fields) => {
  const asset = await assetService.createAsset({ categoryId: 1, serialNumber: `MYA-${unique()}`, ...fields });
  created.push(asset.id);
  return asset;
};

beforeAll(async () => {
  headers.employee = await login('employee@company.com');
  headers.director = await login('admin@company.com');
  me = (await request(app).get('/api/auth/me').set(headers.employee)).body.data;
});
afterAll(async () => {
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.slice().reverse()]);
});

describe('my assets', () => {
  it('shows specs to the employee, and the price only for client assets', async () => {
    const company = await newAsset({ name: 'My Company Laptop', costCents: 5000000, processor: 'i5', ram: '16 GB' });
    const client = await newAsset({
      name: 'My Client Laptop', assetType: 'client', clientName: 'Acme', costCents: 12000000, storage: '512 GB',
    });
    const charger = await newAsset({ name: 'Charger', parentId: client.id });
    // The charger follows its laptop.
    for (const asset of [company, client]) {
      await request(app).post(`/api/assets/${asset.id}/assign`).set(headers.director).send({ employeeId: me.id }).expect(200);
    }

    const mine = (await request(app).get(`/api/employees/${me.id}/assets`).set(headers.employee)).body.data;
    const ownCompany = mine.find((a) => a.id === company.id);
    const ownClient = mine.find((a) => a.id === client.id);
    expect(ownCompany).toMatchObject({ assetType: 'company', costCents: null, processor: 'i5', ram: '16 GB' });
    expect(ownClient).toMatchObject({ assetType: 'client', clientName: 'Acme', costCents: 12000000, storage: '512 GB' });
    expect(ownClient.accessories).toEqual([expect.objectContaining({ id: charger.id, name: 'Charger' })]);

    // People who manage assets still see what company assets cost.
    const seenByDirector = (await request(app).get(`/api/employees/${me.id}/assets`).set(headers.director)).body.data;
    expect(seenByDirector.find((a) => a.id === company.id).costCents).toBe(5000000);
  });
});
