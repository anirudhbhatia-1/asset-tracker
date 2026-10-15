import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';
import employeeService from '../services/employeeService';
import offboardingService from '../services/offboardingService';

// Client-owned assets belong to the client: assign, then return to the
// client. Never retired, reassigned or deleted — by anyone.
const created = { assets: [], employees: [] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
let director;
let dirAuth;

beforeAll(async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@company.com', password: 'password' });
  dirAuth = { Authorization: `Bearer ${res.body.data.token}` };
  director = (await request(app).get('/api/auth/me').set(dirAuth)).body.data;
});
afterAll(async () => {
  await pool.query('DELETE FROM offboarding_requests WHERE employee_id = ANY($1)', [created.employees]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
});

const newClientAsset = async (extra = {}) => {
  const asset = await assetService.createAsset({
    name: 'Client Rule Laptop', serialNumber: `CLR-${unique()}`, categoryId: 1, assetType: 'client', clientName: 'Acme', ...extra,
  });
  created.assets.push(asset.id);
  return asset;
};
const newPerson = async () => {
  const employee = await employeeService.createEmployee({ name: 'Client Rule Person', email: `clr.${unique()}@company.com` });
  created.employees.push(employee.id);
  return employee;
};

describe('client-owned assets', () => {
  it('can be assigned and returned to the client', async () => {
    const asset = await newClientAsset();
    const person = await newPerson();
    expect((await request(app).post(`/api/assets/${asset.id}/assign`).set(dirAuth).send({ employeeId: person.id })).status).toBe(200);
    const back = await request(app).post(`/api/assets/${asset.id}/return`).set(dirAuth).send({});
    expect(back.status).toBe(200);
    expect(back.body.data.status).toBe('returned');
  });

  it('cannot be retired or deleted, even by a Director', async () => {
    const asset = await newClientAsset();
    const retire = await request(app).post(`/api/assets/${asset.id}/retire`).set(dirAuth).send({ confirm: true });
    expect(retire.status).toBe(409);
    expect(retire.body.reason).toBe('CLIENT_ASSET_LOCKED');
    const del = await request(app).delete(`/api/assets/${asset.id}`).set(dirAuth).send({ confirm: true });
    expect(del.status).toBe(409);
    expect((await assetService.getAssetById(asset.id)).status).toBe('available');
  });

  it('cannot be reassigned straight to someone else while in use', async () => {
    const asset = await newClientAsset();
    const [first, second] = [await newPerson(), await newPerson()];
    await assetService.assignAsset(asset.id, first.id, null, null);
    const res = await request(app).post(`/api/assets/${asset.id}/assign`).set(dirAuth).send({ employeeId: second.id });
    expect(res.status).toBe(409);
    expect((await assetService.getAssetById(asset.id)).assignedTo).toBe(first.id);
  });

  it('cannot be switched to company-owned (which would allow retiring it), or created as retired', async () => {
    const asset = await newClientAsset();
    const res = await request(app).patch(`/api/assets/${asset.id}`).set(dirAuth).send({ assetType: 'company' });
    expect(res.status).toBe(400);
    await expect(assetService.createAsset({
      name: 'Born Retired', serialNumber: `CLR-R-${unique()}`, categoryId: 1, assetType: 'client', status: 'retired',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('cannot be written off as missing at an exit', async () => {
    const asset = await newClientAsset();
    const leaver = await newPerson();
    await assetService.assignAsset(asset.id, leaver.id, null, null);
    const exit = await offboardingService.createRequest(director, { employeeId: leaver.id, lastWorkingDate: '2026-10-30' });
    const item = exit.items.find((i) => i.assetId === asset.id);
    await expect(offboardingService.resolveItem(exit.id, item.id, { outcome: 'missing' }, director))
      .rejects.toMatchObject({ statusCode: 409 });
    // Returning it (to the client) still works.
    await offboardingService.resolveItem(exit.id, item.id, { outcome: 'returned' }, director);
    expect((await assetService.getAssetById(asset.id)).status).toBe('returned');
  });

  it('is rejected by the CSV import when marked retired', async () => {
    const csv = `name,serial_number,category,ownership,client_name,status\nCsv Client Laptop,CLR-CSV-${unique()},Laptop,client,Acme,retired\n`;
    const res = await request(app).post('/api/assets/import-csv?dryRun=true').set(dirAuth)
      .attach('file', Buffer.from(csv), 'assets.csv');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).toMatch(/client-owned assets cannot be retired/);
  });
});
