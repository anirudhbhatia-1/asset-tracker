import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';
import employeeService from '../services/employeeService';
import onboardingService from '../services/onboardingService';
import ticketService from '../services/ticketService';

const created = { assets: [], employees: [], tickets: [], requests: [], roles: [] };
afterAll(async () => {
  await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [created.tickets]);
  await pool.query('DELETE FROM onboarding_request_items WHERE onboarding_request_id = ANY($1)', [created.requests]);
  await pool.query('DELETE FROM onboarding_requests WHERE id = ANY($1)', [created.requests]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM sessions WHERE employee_id = ANY($1)', [created.employees]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
  await pool.query('DELETE FROM role_permissions WHERE role_id = ANY($1)', [created.roles]);
  await pool.query('DELETE FROM roles WHERE id = ANY($1)', [created.roles]);
});

// A real Director account, so ids written to history/resolved_by are valid.
const director = { id: null, role: 'director', isDirector: true, permissions: ['*'] };
beforeAll(async () => {
  const { rows: [row] } = await pool.query("SELECT id FROM employees WHERE email = 'admin@company.com'");
  director.id = row.id;
});
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const newAsset = async (extra = {}) => {
  const asset = await assetService.createAsset({ name: 'Rule Test Asset', serialNumber: `RULE-${unique()}`, categoryId: 1, status: 'available', ...extra });
  created.assets.push(asset.id);
  return asset;
};
const newEmployee = async () => {
  const employee = await employeeService.createEmployee({ name: 'Rule Test Person', email: `rule.${unique()}@company.com` });
  created.employees.push(employee.id);
  return employee;
};
const loginAs = async (permissionKeys, { roleAdminType = null } = {}) => {
  const { rows: [role] } = await pool.query(
    'INSERT INTO roles (name, description, admin_type) VALUES ($1, $2, $3) RETURNING id', [`Rule Role ${unique()}`, 'test', roleAdminType]
  );
  created.roles.push(role.id);
  await pool.query('INSERT INTO role_permissions (role_id, permission_id) SELECT $1, id FROM permissions WHERE key = ANY($2)', [role.id, permissionKeys]);
  const { employee, temporaryPassword } = await employeeService.createEmployeeWithAccess({ name: 'Rule Actor', email: `actor.${unique()}@company.com`, roleId: role.id }, director);
  created.employees.push(employee.id);
  await pool.query('UPDATE employees SET must_change_password = false WHERE id = $1', [employee.id]);
  const login = await request(app).post('/api/auth/login').send({ email: employee.email, password: temporaryPassword });
  return { auth: { Authorization: `Bearer ${login.body.data.token}` }, roleId: role.id, employee };
};

describe('role management cannot escalate', () => {
  it("blocks granting permissions the caller doesn't hold and editing their own role", async () => {
    const { auth, roleId } = await loginAs(['roles:read', 'roles:manage', 'assets:read']);
    const tooMuch = await request(app).post('/api/roles').set(auth).send({ name: `Sneaky ${unique()}`, permissionKeys: ['employees:delete'] });
    expect(tooMuch.status).toBe(403);
    const ownRole = await request(app).put(`/api/roles/${roleId}`).set(auth).send({ permissionKeys: ['roles:manage', 'assets:read', 'employees:delete'] });
    expect(ownRole.status).toBe(403);
    const director = await request(app).put('/api/roles/1').set(auth).send({ description: 'x' });
    expect(director.status).toBe(403);
    const allowed = await request(app).post('/api/roles').set(auth).send({ name: `Reader ${unique()}`, permissionKeys: ['assets:read'] });
    expect(allowed.status).toBe(201);
    created.roles.push(allowed.body.data.id);
  });
});

describe('removing employees', () => {
  it('refuses while they hold assets, and non-Directors cannot remove a Director', async () => {
    const holder = await newEmployee();
    const asset = await newAsset();
    await assetService.assignAsset(asset.id, holder.id, null, null);
    await expect(employeeService.deleteEmployee(holder.id, director)).rejects.toMatchObject({ statusCode: 409, details: { assets: [expect.objectContaining({ id: asset.id })] } });
    await assetService.returnAsset(asset.id, null);
    await expect(employeeService.deleteEmployee(holder.id, director)).resolves.toMatchObject({ deleted: true });

    const { rows: [someDirector] } = await pool.query("SELECT id FROM employees WHERE role_id = 1 AND deleted_at IS NULL LIMIT 1");
    const admin = { id: 0, role: 'admin', roleId: 2, permissions: ['employees:delete', 'employees:read'] };
    await expect(employeeService.deleteEmployee(someDirector.id, admin)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("requires employees:grant-access to change a login account's email", async () => {
    const hr = { id: 0, role: 'hr', roleId: 3, permissions: ['employees:read', 'employees:manage'] };
    const { employee } = await employeeService.createEmployeeWithAccess({ name: 'Has Login', email: `login.${unique()}@company.com` }, director);
    created.employees.push(employee.id);
    await expect(employeeService.updateEmployee(employee.id, { email: `other.${unique()}@company.com` }, hr)).rejects.toMatchObject({ statusCode: 403 });
    await expect(employeeService.updateEmployee(employee.id, { department: 'Finance' }, hr)).resolves.toMatchObject({ department: 'Finance' });
  });
});

describe('fulfilment never takes someone else\'s asset', () => {
  it('rejects resolving a ticket with an in-use asset and leaves the ticket unresolved', async () => {
    const requester = await newEmployee();
    const otherHolder = await newEmployee();
    const asset = await newAsset();
    await assetService.assignAsset(asset.id, otherHolder.id, null, null);
    const ticket = await ticketService.createTicket({ id: requester.id, role: 'employee' }, { type: 'request', title: 'Need a laptop', description: 'x', targetAdminType: 'it' });
    created.tickets.push(ticket.id);

    await expect(ticketService.updateTicket(ticket.id, { status: 'resolved', resolvedAssetId: asset.id }, director)).rejects.toMatchObject({ statusCode: 409 });
    expect((await ticketService.getTicketById(ticket.id, director)).status).toBe('open');
    expect((await assetService.getAssetById(asset.id)).assignedTo).toBe(otherHolder.id);

    const spare = await newAsset();
    await ticketService.updateTicket(ticket.id, { status: 'resolved', resolvedAssetId: spare.id }, director);
    expect((await assetService.getAssetById(spare.id)).assignedTo).toBe(requester.id);
  });

  it('enforces ticket status rules', async () => {
    const requester = await newEmployee();
    const ticket = await ticketService.createTicket({ id: requester.id, role: 'employee' }, { type: 'issue', title: 'Rules', description: 'x', targetAdminType: 'it' });
    created.tickets.push(ticket.id);
    await ticketService.updateTicket(ticket.id, { status: 'rejected' }, director);
    await expect(ticketService.updateTicket(ticket.id, { status: 'resolved' }, director)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('keeps onboarding fulfilment when a request is edited and checks the asset', async () => {
    const requester = await newEmployee();
    const request_ = await onboardingService.createRequest({ id: requester.id }, {
      newHireName: 'Future Hire', newHireEmail: `future.${unique()}@company.com`, joiningDate: '2026-11-01',
      items: [{ categoryId: 1, quantity: 1 }, { categoryId: 2, quantity: 1 }],
    });
    created.requests.push(request_.id);
    const laptopItem = request_.items.find((item) => Number(item.category_id) === 1);
    const monitor = await newAsset({ categoryId: 2 });
    await expect(onboardingService.fulfillItem(request_.id, laptopItem.id, monitor.id)).rejects.toMatchObject({ statusCode: 400 });

    const laptop = await newAsset();
    await onboardingService.fulfillItem(request_.id, laptopItem.id, laptop.id);
    await onboardingService.updateRequestDetails(request_.id, {
      newHireName: 'Future Hire (renamed)', joiningDate: '2026-11-02', items: [{ categoryId: 1, quantity: 1, notes: 'MacBook please' }],
    });
    const after = await onboardingService.getRequestById(request_.id);
    expect(after.items).toHaveLength(1);
    expect(after.items[0].fulfilled_asset_id).toBe(laptop.id);
    await expect(onboardingService.updateRequestDetails(request_.id, { newHireName: 'x', joiningDate: '2026-11-02', items: [] }))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('accessory cascades', () => {
  it("never moves an accessory someone else is using", async () => {
    const [first, second] = [await newEmployee(), await newEmployee()];
    const laptop = await newAsset();
    const ownAdaptor = await newAsset({ name: 'Own adaptor' });
    const borrowedAdaptor = await newAsset({ name: 'Borrowed adaptor' });
    await pool.query('UPDATE assets SET parent_id = $1 WHERE id = ANY($2)', [laptop.id, [ownAdaptor.id, borrowedAdaptor.id]]);
    await assetService.assignAsset(borrowedAdaptor.id, second.id, null, null);

    await assetService.assignAsset(laptop.id, first.id, null, null);
    expect((await assetService.getAssetById(ownAdaptor.id)).assignedTo).toBe(first.id);
    expect((await assetService.getAssetById(borrowedAdaptor.id)).assignedTo).toBe(second.id);

    await assetService.returnAsset(laptop.id, null);
    expect((await assetService.getAssetById(borrowedAdaptor.id)).assignedTo).toBe(second.id);
  });
});

describe('bad ids', () => {
  it('returns 400, not 500, for non-numeric ticket ids', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@company.com', password: 'password' });
    const res = await request(app).get('/api/tickets/abc/history').set('Authorization', `Bearer ${login.body.data.token}`);
    expect(res.status).toBe(400);
  });
});
