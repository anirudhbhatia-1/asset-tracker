import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';
import employeeService from '../services/employeeService';
import { purgeExpiredSessions } from '../services/authService';
import { sweepUploadTmp } from '../utils/uploadTmp';
import { escapeLike } from '../utils/like';

// Fixes from the 16 Oct 2026 gap audit.
const created = { assets: [], employees: [], tickets: [] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const headers = {};

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  return { Authorization: `Bearer ${res.body.data.token}` };
};

beforeAll(async () => {
  headers.director = await login('admin@company.com');
  headers.employee = await login('employee@company.com');
});
afterAll(async () => {
  await pool.query('DELETE FROM ticket_history WHERE ticket_id = ANY($1)', [created.tickets]);
  await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [created.tickets]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
});

describe('scanner', () => {
  it('allows a stocktake pace per user and returns no history', async () => {
    const asset = await assetService.createAsset({ name: 'Scan Gap Laptop', serialNumber: `SCAN-${unique()}`, categoryId: 1 });
    created.assets.push(asset.id);
    for (let i = 0; i < 15; i += 1) {
      const res = await request(app).get(`/api/serial/scan/${asset.serialNumber}`).set(headers.director);
      expect(res.status).toBe(200);
      expect(res.body.data.history).toBeUndefined();
    }
  });

  it('does not repeat the typed serial in "not found"', async () => {
    const res = await request(app).get('/api/serial/scan/NOPE-SECRET-123').set(headers.director);
    expect(res.status).toBe(404);
    expect(res.body.message).not.toContain('NOPE-SECRET-123');
  });
});

describe('search', () => {
  it('treats % and _ literally', async () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    const assets = await request(app).get('/api/assets?q=%25').set(headers.director);
    expect(assets.status).toBe(200);
    expect(assets.body.data.every((a) => `${a.name}${a.serialNumber}${a.model || ''}`.includes('%'))).toBe(true);
    const employees = await request(app).get('/api/employees?q=%25').set(headers.director);
    expect(employees.body.data.every((e) => `${e.name}${e.email}`.includes('%'))).toBe(true);
  });
});

describe('API responses', () => {
  it('answers unknown routes without echoing the address', async () => {
    const res = await request(app).get('/api/no-such-route?token=abc').set(headers.director);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Not found');
  });

  it('never fetches or returns password hashes in employee lists, and still knows who can sign in', async () => {
    const res = await request(app).get('/api/employees').set(headers.director);
    const me = res.body.data.find((e) => e.email === 'employee@company.com');
    expect(me.hasLogin).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/password_?hash/i);
    const directoryOnly = await employeeService.createEmployee({ name: 'No Login Gap', email: `nologin.${unique()}@company.com` });
    created.employees.push(directoryOnly.id);
    expect((await employeeService.getEmployeeById(directoryOnly.id)).hasLogin).toBe(false);
  });
});

describe('tickets', () => {
  it('limits description, resolution notes and transfer notes', async () => {
    const tooLong = await request(app).post('/api/tickets').set(headers.employee)
      .send({ type: 'issue', title: 'Long', targetAdminType: 'it', description: 'x'.repeat(2001) });
    expect(tooLong.status).toBe(400);
    const ok = await request(app).post('/api/tickets').set(headers.employee)
      .send({ type: 'issue', title: 'Fine', targetAdminType: 'it', description: 'x'.repeat(2000) });
    expect(ok.status).toBe(201);
    created.tickets.push(ok.body.data.id);
    const transfer = await request(app).patch(`/api/tickets/${ok.body.data.id}/transfer`).set(headers.director)
      .send({ targetAdminType: 'hardware', note: 'n'.repeat(1001) });
    expect(transfer.status).toBe(400);
  });
});

describe('assigning from the employee page', () => {
  it('refuses client-owned assets, like the Inventory bulk assign', async () => {
    const person = await employeeService.createEmployee({ name: 'Gap Assignee', email: `gap.${unique()}@company.com` });
    created.employees.push(person.id);
    const clientAsset = await assetService.createAsset({
      name: 'Gap Client Laptop', serialNumber: `GAPC-${unique()}`, categoryId: 1, assetType: 'client', clientName: 'Acme',
    });
    created.assets.push(clientAsset.id);
    const res = await request(app).post(`/api/employees/${person.id}/assign-assets`).set(headers.director)
      .send({ assetIds: [clientAsset.id] });
    expect(res.status).toBe(409);
    const tooMany = await request(app).post(`/api/employees/${person.id}/assign-assets`).set(headers.director)
      .send({ assetIds: Array.from({ length: 201 }, (_, i) => i + 1) });
    expect(tooMany.status).toBe(400);
  });
});

describe('housekeeping', () => {
  it('removes expired sign-ins without waiting for a login', async () => {
    const { rows: [person] } = await pool.query("SELECT id FROM employees WHERE email = 'employee@company.com'");
    await pool.query(
      "INSERT INTO sessions (token, employee_id, expires_at) VALUES ($1, $2, NOW() - INTERVAL '1 hour')",
      [`expired-${unique()}`, person.id]
    );
    expect(await purgeExpiredSessions()).toBeGreaterThanOrEqual(1);
    const { rows } = await pool.query('SELECT 1 FROM sessions WHERE expires_at < NOW()');
    expect(rows).toHaveLength(0);
  });

  it('sweeps upload files left by a crash, but not ones in use', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assettrack-upload-'));
    const stale = path.join(dir, 'stale');
    const fresh = path.join(dir, 'fresh');
    fs.writeFileSync(stale, 'x');
    fs.writeFileSync(fresh, 'x');
    const twoHoursAgo = (Date.now() - 2 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(stale, twoHoursAgo, twoHoursAgo);
    expect(sweepUploadTmp(dir)).toBe(1);
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.existsSync(fresh)).toBe(true);
    expect(sweepUploadTmp(path.join(dir, 'missing'))).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('test-only Google access', () => {
  it('is refused when NODE_ENV is anything but development or test', async () => {
    const before = process.env.NODE_ENV;
    try {
      delete process.env.NODE_ENV;
      const res = await request(app).post('/api/employees/1/grant-google-access').set(headers.director);
      expect(res.status).toBe(403);
    } finally {
      process.env.NODE_ENV = before;
    }
  });
});
