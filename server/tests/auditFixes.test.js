import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';
import employeeService from '../services/employeeService';
import stockService from '../services/stockService';

// Fixes from the October 2026 review: closed tickets, transfers, role/queue
// changes, removed employees, bulk items at exit, client assets handed back,
// and input validation.
const created = { assets: [], employees: [], tickets: [], items: [] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const headers = {};
let director;

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  return { Authorization: `Bearer ${res.body.data.token}` };
};
const newPerson = async (extra = {}) => {
  const person = await employeeService.createEmployee({ name: 'Audit Fix Person', email: `fix.${unique()}@company.com`, ...extra });
  created.employees.push(person.id);
  return person;
};
const raise = async (body = {}) => {
  const res = await request(app).post('/api/tickets').set(headers.employee)
    .send({ type: 'issue', title: 'Audit fix ticket', targetAdminType: 'it', ...body });
  created.tickets.push(res.body.data.id);
  return res.body.data;
};

beforeAll(async () => {
  headers.employee = await login('employee@company.com');
  headers.it = await login('itadmin@company.com');
  headers.director = await login('admin@company.com');
  director = (await request(app).get('/api/auth/me').set(headers.director)).body.data;
});
afterAll(async () => {
  await pool.query('DELETE FROM ticket_history WHERE ticket_id = ANY($1)', [created.tickets]);
  await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [created.tickets]);
  await pool.query('DELETE FROM stock_holdings WHERE stock_item_id = ANY($1)', [created.items]);
  await pool.query('DELETE FROM stock_items WHERE id = ANY($1)', [created.items]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
});

describe('tickets', () => {
  it('cannot be changed once closed, keeping who resolved it', async () => {
    const t = await raise();
    await request(app).patch(`/api/tickets/${t.id}`).set(headers.it).send({ status: 'resolved', resolutionNotes: 'Fixed' }).expect(200);
    await request(app).patch(`/api/tickets/${t.id}/confirm-close`).set(headers.employee).send({}).expect(200);
    const { rows: [closed] } = await pool.query('SELECT status, resolved_by FROM tickets WHERE id = $1', [t.id]);
    expect(closed.status).toBe('closed');
    const edit = await request(app).patch(`/api/tickets/${t.id}`).set(headers.it).send({ resolutionNotes: 'Rewritten' });
    expect(edit.status).toBe(400);
    const { rows: [after] } = await pool.query('SELECT resolved_by, resolution_notes FROM tickets WHERE id = $1', [t.id]);
    expect(after).toMatchObject({ resolved_by: closed.resolved_by, resolution_notes: 'Fixed' });
  });

  it('can only be transferred while open or in progress', async () => {
    const t = await raise();
    await request(app).patch(`/api/tickets/${t.id}`).set(headers.it).send({ status: 'resolved' }).expect(200);
    const res = await request(app).patch(`/api/tickets/${t.id}/transfer`).set(headers.it).send({ targetAdminType: 'hardware' });
    expect(res.status).toBe(400);
  });
});

describe('roles and ticket queues', () => {
  it('will not give a role to someone without a login', async () => {
    const person = await newPerson();
    const res = await request(app).patch(`/api/employees/${person.id}/role`).set(headers.director).send({ role: 'employee' });
    expect(res.status).toBe(400);
    expect((await employeeService.getEmployeeById(person.id)).role).toBeNull();
  });

  it('takes the ticket queue away when someone leaves an admin role or loses access', async () => {
    const person = await newPerson();
    await employeeService.grantEmployeeAccess(person.id, 'admin', 'x'.repeat(60), director);
    await pool.query("UPDATE employees SET admin_type = 'it' WHERE id = $1", [person.id]);
    await employeeService.updateEmployeeRole(person.id, 'employee', director);
    expect((await pool.query('SELECT admin_type FROM employees WHERE id = $1', [person.id])).rows[0].admin_type).toBeNull();

    await pool.query("UPDATE employees SET admin_type = 'hr' WHERE id = $1", [person.id]);
    await employeeService.revokeEmployeeAccess(person.id, director);
    expect((await pool.query('SELECT admin_type FROM employees WHERE id = $1', [person.id])).rows[0].admin_type).toBeNull();
  });

  it('refuses changes to a removed employee', async () => {
    const person = await newPerson();
    await employeeService.deleteEmployee(person.id, director);
    await expect(employeeService.updateEmployee(person.id, { name: 'Ghost' }, director)).rejects.toMatchObject({ statusCode: 400 });
    await expect(employeeService.grantEmployeeAccess(person.id, 'employee', 'x'.repeat(60), director)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('bulk items at exit', () => {
  it('blocks removing someone who still holds bulk items', async () => {
    const person = await newPerson();
    const item = await stockService.createItem({ name: `Fix Bag ${unique()}`, quantity: 3 }, director);
    created.items.push(item.id);
    await stockService.assign(item.id, person.id, 2, null, director);
    await expect(employeeService.deleteEmployee(person.id, director)).rejects.toMatchObject({ statusCode: 409 });
    await stockService.takeBack(item.id, person.id, 2, null, director);
    await employeeService.deleteEmployee(person.id, director);
  });
});

describe('client assets handed back', () => {
  it('cannot be assigned again', async () => {
    const person = await newPerson();
    const asset = await assetService.createAsset({
      name: 'Fix Client Laptop', serialNumber: `FIX-${unique()}`, categoryId: 1, assetType: 'client', clientName: 'Acme',
    });
    created.assets.push(asset.id);
    await request(app).post(`/api/assets/${asset.id}/assign`).set(headers.director).send({ employeeId: person.id }).expect(200);
    await request(app).post(`/api/assets/${asset.id}/return`).set(headers.director).send({}).expect(200);
    const again = await request(app).post(`/api/assets/${asset.id}/assign`).set(headers.director).send({ employeeId: person.id });
    expect(again.status).toBe(409);
  });
});

describe('input validation', () => {
  it('answers 400, not 500, for empty entries in lists', async () => {
    const onboarding = await request(app).post('/api/onboarding').set(headers.director)
      .send({ newHireName: 'Null Item', newHireEmail: `null.${unique()}@company.com`, joiningDate: '2026-11-01', items: [null] });
    expect(onboarding.status).toBe(400);
    const asset = await request(app).post('/api/assets').set(headers.director)
      .send({ name: 'Null Sub', serialNumber: `NS-${unique()}`, categoryId: 1, subAssets: [null] });
    expect(asset.status).toBe(400);
  });
});
