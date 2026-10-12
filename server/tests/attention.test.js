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
import attentionService from '../services/attentionService';
import { todayISO } from '../utils/dates';

const created = { assets: [], employees: [], items: [], tickets: [], onboarding: [], offboarding: [] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const director = { id: null, name: 'Test Director', role: 'director', isDirector: true, permissions: ['*'] };
let auth = {};
let employeeUser;
let hrUser;
const today = todayISO();
const { addDays } = attentionService;

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  expect(res.status).toBe(200);
  return { Authorization: `Bearer ${res.body.data.token}` };
};
const attention = async (who) => {
  const res = await request(app).get('/api/dashboard/attention').set(auth[who]);
  expect(res.status).toBe(200);
  return res.body.data.items;
};
const itemOf = (items, key) => items.find((item) => item.key === key);
const countOf = (items, key) => itemOf(items, key)?.count || 0;

const newAsset = async (extra = {}) => {
  const asset = await assetService.createAsset({
    name: 'Attention Asset', serialNumber: `ATTN-${unique()}`, categoryId: 1, status: 'available', ...extra,
  });
  created.assets.push(asset.id);
  return asset;
};
const newPerson = async (name = 'Attention Person') => {
  const employee = await employeeService.createEmployee({ name, email: `attn.${unique()}@company.com` });
  created.employees.push(employee.id);
  return employee;
};

beforeAll(async () => {
  auth = {
    director: await login('admin@company.com'),
    admin: await login('itadmin@company.com'),
    hr: await login('hr@company.com'),
    employee: await login('employee@company.com'),
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
  await pool.query('DELETE FROM sessions WHERE employee_id = ANY($1)', [created.employees]);
  await pool.query("DELETE FROM access_audit WHERE target_type = 'employee' AND target_id = ANY($1)", [created.employees]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
});

describe('GET /api/dashboard/attention', () => {
  it('requires a session and returns well-formed, sorted items', async () => {
    expect((await request(app).get('/api/dashboard/attention')).status).toBe(401);
    const res = await request(app).get('/api/dashboard/attention').set(auth.director);
    expect(res.body.message).toBeTruthy();
    const { items } = res.body.data;
    const rank = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < items.length; i += 1) {
      const [a, b] = [items[i - 1], items[i]];
      expect(rank[a.severity] < rank[b.severity] || (a.severity === b.severity && a.count >= b.count)).toBe(true);
    }
    for (const item of items) {
      expect(item).toEqual({
        key: expect.any(String), severity: expect.stringMatching(/^(high|medium|low)$/), title: expect.any(String),
        count: expect.any(Number), link: expect.any(String), entries: expect.any(Array),
      });
      expect(item.count).toBeGreaterThan(0);
      expect(item.entries.length).toBeLessThanOrEqual(5);
    }
  });

  it('shows employees only their resolved tickets awaiting confirmation', async () => {
    const before = countOf(await attention('employee'), 'tickets_confirm');
    const ticket = await ticketService.createTicket(employeeUser, { type: 'issue', title: `Confirm me ${unique()}` });
    created.tickets.push(ticket.id);
    await pool.query("UPDATE tickets SET status = 'resolved' WHERE id = $1", [ticket.id]);
    const items = await attention('employee');
    expect(items.map((item) => item.key)).toEqual(['tickets_confirm']);
    const item = itemOf(items, 'tickets_confirm');
    expect(item.count).toBe(before + 1);
    expect(item.severity).toBe('medium');
    if (item.count <= 5) {
      expect(item.entries).toContainEqual(expect.objectContaining({ label: ticket.title, link: `/tickets?ticket=${ticket.id}` }));
    }
    // Someone else's resolved ticket doesn't appear for the director.
    expect(countOf(await attention('director'), 'tickets_confirm'))
      .toBe((await pool.query("SELECT COUNT(*)::int AS c FROM tickets WHERE status = 'resolved' AND employee_id = $1", [director.id])).rows[0].c);
  });

  it('lists the resolver queue, high once a ticket is older than 3 days', async () => {
    const before = await attention('hr');
    const queueBefore = countOf(before, 'tickets_queue');
    const fresh = await ticketService.createTicket(employeeUser, { type: 'request', title: `HR queue ${unique()}`, targetAdminType: 'hr' });
    created.tickets.push(fresh.id);
    let item = itemOf(await attention('hr'), 'tickets_queue');
    expect(item.count).toBe(queueBefore + 1);
    expect(item.link).toBe('/tickets');

    // The IT admin's queue doesn't include HR tickets; the director sees all.
    const itCount = (await pool.query("SELECT COUNT(*)::int AS c FROM tickets WHERE status IN ('open','in_progress') AND current_admin_type = 'it'")).rows[0].c;
    expect(countOf(await attention('admin'), 'tickets_queue')).toBe(itCount);
    const allCount = (await pool.query("SELECT COUNT(*)::int AS c FROM tickets WHERE status IN ('open','in_progress')")).rows[0].c;
    expect(countOf(await attention('director'), 'tickets_queue')).toBe(allCount);

    await pool.query("UPDATE tickets SET created_at = NOW() - INTERVAL '5 days' WHERE id = $1", [fresh.id]);
    item = itemOf(await attention('hr'), 'tickets_queue');
    expect(item.severity).toBe('high');
    const entry = item.entries.find((e) => e.link === `/tickets?ticket=${fresh.id}`);
    if (entry) expect(entry.sublabel).toBe(`Raised by ${employeeUser.name} · 5 days ago`);

    // Employees never see the queue.
    expect(itemOf(await attention('employee'), 'tickets_queue')).toBeUndefined();
  });

  it('flags new hires joining within a week', async () => {
    const before = countOf(await attention('hr'), 'onboarding_soon');
    const soon = await onboardingService.createRequest(hrUser, {
      newHireName: `Soon Hire ${unique()}`, joiningDate: addDays(today, 1), items: [{ categoryId: 1, quantity: 1 }, { categoryId: 1 }],
    });
    const later = await onboardingService.createRequest(hrUser, { newHireName: 'Later Hire', joiningDate: addDays(today, 20), items: [] });
    created.onboarding.push(soon.id, later.id);
    const item = itemOf(await attention('hr'), 'onboarding_soon');
    expect(item.count).toBe(before + 1);
    expect(item.severity).toBe('high');
    const entry = item.entries.find((e) => e.link === `/onboarding?request=${soon.id}`);
    if (entry) {
      expect(entry.label).toBe(soon.new_hire_name);
      expect(entry.sublabel).toBe(`Joins ${attentionService.formatDate(addDays(today, 1))} · 2 items to arrange`);
    }
    await onboardingService.updateRequestStatus(soon.id, 'cancelled', hrUser);
    expect(countOf(await attention('hr'), 'onboarding_soon')).toBe(before);
    // No onboarding permission, no item.
    expect(itemOf(await attention('employee'), 'onboarding_soon')).toBeUndefined();
  });

  it('flags exits within a week only while the leaver still holds assets', async () => {
    const before = countOf(await attention('hr'), 'offboarding_soon');
    const leaver = await newPerson('Leaving Soon');
    const emptyHanded = await newPerson('Leaving Empty');
    const laptop = await newAsset();
    await assetService.assignAsset(laptop.id, leaver.id, null, null);
    const exit = await offboardingService.createRequest(director, { employeeId: leaver.id, lastWorkingDate: addDays(today, 5) });
    const exit2 = await offboardingService.createRequest(director, { employeeId: emptyHanded.id, lastWorkingDate: addDays(today, 1) });
    created.offboarding.push(exit.id, exit2.id);

    let item = itemOf(await attention('hr'), 'offboarding_soon');
    expect(item.count).toBe(before + 1);
    expect(item.link).toBe('/offboarding');
    const entry = item.entries.find((e) => e.link === `/offboarding?request=${exit.id}`);
    if (entry) expect(entry.sublabel).toBe(`Last day ${attentionService.formatDate(addDays(today, 5))} · 1 asset to collect`);

    await pool.query('UPDATE offboarding_requests SET last_working_date = $1 WHERE id = $2', [addDays(today, -1), exit.id]);
    item = itemOf(await attention('hr'), 'offboarding_soon');
    expect(item.severity).toBe('high');

    await assetService.returnAsset(laptop.id, null);
    expect(countOf(await attention('hr'), 'offboarding_soon')).toBe(before);
  });

  it('counts company warranties expiring in 60 days (same window as the Inventory filter) and low bulk stock, for inventory readers only', async () => {
    const before = await attention('admin');
    await newAsset({ name: 'Warranty Soon', warrantyExpiryDate: addDays(today, 10) });
    await newAsset({ name: 'Warranty Client', assetType: 'client', warrantyExpiryDate: addDays(today, 10) });
    await newAsset({ name: 'Warranty Later', warrantyExpiryDate: addDays(today, 70) });
    await newAsset({ name: 'Warranty Past', warrantyExpiryDate: addDays(today, -1) });
    const retired = await newAsset({ name: 'Warranty Retired', warrantyExpiryDate: addDays(today, 3) });
    await assetService.retireAsset(retired.id, null, true);

    const low = await stockService.createItem({ name: `Low Bag ${unique()}`, quantity: 3, lowStockThreshold: 5 }, director);
    const fine = await stockService.createItem({ name: `Fine Bag ${unique()}`, quantity: 30, lowStockThreshold: 5 }, director);
    created.items.push(low.id, fine.id);

    const items = await attention('admin');
    const warranty = itemOf(items, 'warranty_expiring');
    expect(warranty.count).toBe(countOf(before, 'warranty_expiring') + 1);
    expect(warranty).toMatchObject({ severity: 'medium', link: '/inventory?warranty=expiring-soon' });
    for (const entry of warranty.entries) {
      expect(entry.link).toMatch(/^\/inventory\/\d+$/);
      expect(entry.sublabel).toMatch(/^Expires /);
    }
    const lowStock = itemOf(items, 'low_stock');
    expect(lowStock.count).toBe(countOf(before, 'low_stock') + 1);
    expect(lowStock).toMatchObject({ severity: 'medium', link: '/inventory?view=bulk' });
    const lowEntry = lowStock.entries.find((e) => e.label === low.name);
    if (lowEntry) expect(lowEntry.sublabel).toBe('3 of 3 left');

    // The employee role has no inventory access.
    const employeeItems = await attention('employee');
    expect(itemOf(employeeItems, 'warranty_expiring')).toBeUndefined();
    expect(itemOf(employeeItems, 'low_stock')).toBeUndefined();
  });

  it('shows locked accounts and pending password changes to those who manage access', async () => {
    const before = await attention('admin');
    const { employee: locked } = await employeeService.createEmployeeWithAccess(
      { name: `Locked ${unique()}`, email: `locked.${unique()}@company.com`, roleId: 4 }, director,
    );
    created.employees.push(locked.id);
    await pool.query("UPDATE employees SET locked_until = NOW() + INTERVAL '1 hour' WHERE id = $1", [locked.id]);

    const items = await attention('admin');
    const lockedItem = itemOf(items, 'locked_accounts');
    expect(lockedItem.count).toBe(countOf(before, 'locked_accounts') + 1);
    expect(lockedItem).toMatchObject({ severity: 'high', link: '/employees' });
    const entry = lockedItem.entries.find((e) => e.label === locked.name);
    if (entry) expect(entry.sublabel).toMatch(/^Locked until \d\d:\d\d, /);

    const pending = itemOf(items, 'password_change_pending');
    expect(pending.count).toBe(countOf(before, 'password_change_pending') + 1);
    expect(pending).toMatchObject({ severity: 'low', link: '/employees', entries: [] });
    expect(pending.title).toMatch(pending.count === 1 ? /^1 person hasn't set/ : new RegExp(`^${pending.count} people haven't set their own password yet$`));

    // Low severity sorts after everything else.
    expect(items[items.length - 1].severity).toBe('low');
    expect(itemOf(await attention('employee'), 'locked_accounts')).toBeUndefined();
  });
});
