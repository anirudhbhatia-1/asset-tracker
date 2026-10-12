import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';
import employeeService from '../services/employeeService';
import stockService from '../services/stockService';
import ticketService from '../services/ticketService';
import onboardingService from '../services/onboardingService';
import offboardingService from '../services/offboardingService';
import searchService, { escapeLike, ticketIdFrom } from '../services/searchService';

const created = { assets: [], employees: [], items: [], tickets: [], onboarding: [], offboarding: [] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const director = { id: null, name: 'Test Director', role: 'director', isDirector: true, permissions: ['*'] };
let auth = {};
let employeeUser;
let hrUser;

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  expect(res.status).toBe(200);
  return { Authorization: `Bearer ${res.body.data.token}` };
};
const search = (who, query) => request(app).get('/api/search').query(query).set(auth[who]);

const newAsset = async (extra = {}) => {
  const asset = await assetService.createAsset({
    name: 'Search Test Asset', serialNumber: `SRCHT-${unique()}`, categoryId: 1, status: 'available', ...extra,
  });
  created.assets.push(asset.id);
  return asset;
};

beforeAll(async () => {
  auth = {
    director: await login('admin@company.com'),
    hr: await login('hr@company.com'),
    employee: await login('employee@company.com'),
    admin: await login('itadmin@company.com'),
  };
  director.id = (await pool.query("SELECT id FROM employees WHERE email = 'admin@company.com'")).rows[0].id;
  employeeUser = (await request(app).get('/api/auth/me').set(auth.employee)).body.data;
  hrUser = (await request(app).get('/api/auth/me').set(auth.hr)).body.data;
});

afterAll(async () => {
  await pool.query('DELETE FROM ticket_history WHERE ticket_id = ANY($1)', [created.tickets]);
  await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [created.tickets]);
  await pool.query('DELETE FROM onboarding_request_items WHERE onboarding_request_id = ANY($1)', [created.onboarding]);
  await pool.query('DELETE FROM onboarding_requests WHERE id = ANY($1)', [created.onboarding]);
  await pool.query('DELETE FROM offboarding_requests WHERE id = ANY($1)', [created.offboarding]);
  await pool.query('DELETE FROM stock_history WHERE stock_item_id = ANY($1)', [created.items]);
  await pool.query('DELETE FROM stock_items WHERE id = ANY($1)', [created.items]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
});

describe('GET /api/search validation', () => {
  it('requires a session', async () => {
    expect((await request(app).get('/api/search?q=laptop')).status).toBe(401);
  });

  it('rejects missing, too short, too long and repeated search text', async () => {
    expect((await search('director', {})).status).toBe(400);
    expect((await search('director', { q: ' a ' })).status).toBe(400);
    expect((await search('director', { q: 'x'.repeat(101) })).status).toBe(400);
    expect((await request(app).get('/api/search?q=ab&q=cd').set(auth.director)).status).toBe(400);
    expect((await request(app).get('/api/search?q=ab&limit=1&limit=2').set(auth.director)).status).toBe(400);
  });

  it('rejects a bad limit and caps a large one at 10', async () => {
    expect((await search('director', { q: 'ab', limit: 'abc' })).status).toBe(400);
    expect((await search('director', { q: 'ab', limit: '0' })).status).toBe(400);
    expect((await search('director', { q: 'ab', limit: '-1' })).status).toBe(400);
    const token = `Cap${unique()}`;
    for (let i = 0; i < 12; i += 1) await newAsset({ name: `${token} ${i}` });
    const capped = await search('director', { q: token, limit: '50' });
    expect(capped.status).toBe(200);
    expect(capped.body.data.assets).toHaveLength(10);
    const two = await search('director', { q: token, limit: '2' });
    expect(two.body.data.assets).toHaveLength(2);
    const byDefault = await search('director', { q: token });
    expect(byDefault.body.data.assets).toHaveLength(5);
  });
});

describe('GET /api/search results', () => {
  it('finds assets by name, serial, model and brand, exact serial first, including client-owned', async () => {
    const token = unique();
    const serial = `SRX-${token}`;
    const partial = await newAsset({ name: `Alpha ${token}`, serialNumber: `${serial}-2` });
    const exact = await newAsset({ name: `Zulu ${token}`, serialNumber: serial });
    const client = await newAsset({ name: 'Client Box', serialNumber: `CLI-${unique()}`, assetType: 'client', brand: `Brand${token}` });
    const byModel = await newAsset({ name: 'Model Box', model: `Mdl${token}` });
    const holder = await employeeService.createEmployee({ name: `Holder ${token}`, email: `holder.${token}@company.com` });
    created.employees.push(holder.id);
    await assetService.assignAsset(byModel.id, holder.id, null, null);

    const res = await search('director', { q: serial.toLowerCase() });
    expect(res.status).toBe(200);
    expect(res.body.data.assets.map((a) => a.id)).toEqual([exact.id, partial.id]);
    expect(res.body.data.assets[0]).toEqual({
      id: exact.id, name: `Zulu ${token}`, serialNumber: serial, status: 'available',
      assetType: 'company', categoryName: expect.any(String), assignedToName: null,
    });

    const brand = await search('director', { q: `brand${token}` });
    expect(brand.body.data.assets).toEqual([expect.objectContaining({ id: client.id, assetType: 'client' })]);
    const model = await search('director', { q: `Mdl${token}` });
    expect(model.body.data.assets).toEqual([expect.objectContaining({ id: byModel.id, status: 'in-use', assignedToName: `Holder ${token}` })]);
  });

  it('treats LIKE wildcards in the search text literally', async () => {
    const token = unique();
    await newAsset({ name: `Wild ${token}xyz` });
    const literal = await newAsset({ name: `Wild ${token}%_ literal` });
    expect((await search('director', { q: `${token}%` })).body.data.assets.map((a) => a.id)).toEqual([literal.id]);
    expect((await search('director', { q: `${token}_` })).body.data.assets).toEqual([]);
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('finds bulk stock items, active employees, onboarding and offboarding requests', async () => {
    const token = unique();
    const item = await stockService.createItem({ name: `Bag ${token}`, quantity: 8, location: 'Pune' }, director);
    created.items.push(item.id);

    const active = await employeeService.createEmployee({ name: `Person ${token}`, email: `p.${token}@company.com`, department: 'Finance', workMode: 'remote' });
    const gone = await employeeService.createEmployee({ name: `Gone ${token}`, email: `g.${token}@company.com` });
    created.employees.push(active.id, gone.id);
    await pool.query('UPDATE employees SET deleted_at = NOW() WHERE id = $1', [gone.id]);

    const hire = await onboardingService.createRequest(hrUser, { newHireName: `Hire ${token}`, joiningDate: '2026-11-02', items: [] });
    created.onboarding.push(hire.id);
    const exit = await offboardingService.createRequest(director, { employeeId: active.id, lastWorkingDate: '2026-11-30' });
    created.offboarding.push(exit.id);

    const res = await search('director', { q: token });
    expect(res.status).toBe(200);
    expect(res.body.data.stock).toEqual([{ id: item.id, name: `Bag ${token}`, location: 'Pune', inStock: 8, totalQuantity: 8 }]);
    expect(res.body.data.employees).toEqual([{
      id: active.id, name: `Person ${token}`, email: `p.${token}@company.com`, department: 'Finance',
      workMode: 'remote', hasLogin: false, deleted: false,
    }]);
    expect(res.body.data.onboarding).toEqual([{ id: hire.id, newHireName: `Hire ${token}`, joiningDate: '2026-11-02', status: 'pending' }]);
    expect(res.body.data.offboarding).toEqual([{ id: exit.id, employeeName: `Person ${token}`, lastWorkingDate: '2026-11-30', status: 'pending' }]);

    // Department matches too.
    const finance = await search('director', { q: 'Finance', limit: '10' });
    expect(finance.body.data.employees.every((e) => e.department === 'Finance' || e.name.includes('Finance') || e.email.includes('finance'))).toBe(true);
  });

  it('finds tickets by title and id, showing non-resolvers only their own', async () => {
    const token = unique();
    const own = await ticketService.createTicket(employeeUser, { type: 'issue', title: `Screen ${token}` });
    const other = await ticketService.createTicket(hrUser, { type: 'issue', title: `Screen ${token} other` });
    created.tickets.push(own.id, other.id);

    const asDirector = await search('director', { q: token });
    expect(asDirector.body.data.tickets.map((t) => t.id).sort()).toEqual([own.id, other.id].sort());
    expect(asDirector.body.data.tickets.find((t) => t.id === own.id)).toEqual({
      id: own.id, title: `Screen ${token}`, status: 'open', type: 'issue',
      employeeName: employeeUser.name, createdAt: expect.any(String),
    });

    const asEmployee = await search('employee', { q: token });
    expect(asEmployee.body.data.tickets.map((t) => t.id)).toEqual([own.id]);
    expect((await search('employee', { q: `#${other.id}` })).body.data.tickets).toEqual([]);
    expect((await search('employee', { q: `#${own.id}` })).body.data.tickets.map((t) => t.id)).toContain(own.id);

    const byId = await search('admin', { q: String(other.id) });
    expect(byId.body.data.tickets[0].id).toBe(other.id);
    expect(ticketIdFrom('TK-0042')).toBe(42);
    expect(ticketIdFrom('#7')).toBe(7);
    expect(ticketIdFrom('laptop')).toBeNull();
  });

  it('only includes the groups the user may read', async () => {
    const director_ = await search('director', { q: 'zz' });
    expect(Object.keys(director_.body.data).sort()).toEqual(['assets', 'employees', 'offboarding', 'onboarding', 'stock', 'tickets']);
    expect(director_.body.message).toBeTruthy();

    // A role with people access but no inventory access.
    const peopleOnly = { id: hrUser.id, role: 'hr', roleId: 999, permissions: ['employees:read', 'tickets:read', 'offboarding:read'] };
    const data = await searchService.search(peopleOnly, 'zz', 5);
    expect(Object.keys(data).sort()).toEqual(['employees', 'offboarding', 'tickets']);

    const employee = await search('employee', { q: 'zz' });
    expect(Object.keys(employee.body.data)).toEqual(['tickets']);
  });
});
