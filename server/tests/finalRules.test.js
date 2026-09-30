import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import * as assetService from '../services/assetService';
import employeeService from '../services/employeeService';
import ticketService from '../services/ticketService';

const created = { assets: [], employees: [], tickets: [] };
const director = { id: null, role: 'director', isDirector: true, permissions: ['*'] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

beforeAll(async () => {
  director.id = (await pool.query("SELECT id FROM employees WHERE email = 'admin@company.com'")).rows[0].id;
});
afterAll(async () => {
  await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [created.tickets]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM sessions WHERE employee_id = ANY($1)', [created.employees]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
});

const newAsset = async () => {
  const asset = await assetService.createAsset({ name: 'Final Rule Asset', serialNumber: `FINAL-${unique()}`, categoryId: 1, status: 'available' });
  created.assets.push(asset.id);
  return asset;
};
const newLogin = async (roleId = 4) => {
  const { employee, temporaryPassword } = await employeeService.createEmployeeWithAccess(
    { name: 'Final Rule Person', email: `final.${unique()}@company.com`, roleId }, director,
  );
  created.employees.push(employee.id);
  return { employee, temporaryPassword };
};

describe('account recovery', () => {
  it('resets a password to a new temporary one and can revoke access', async () => {
    const { employee, temporaryPassword } = await newLogin();
    const loginRes = await request(app).post('/api/auth/login').send({ email: employee.email, password: temporaryPassword });
    const token = loginRes.body.data.token;

    const directorLogin = await request(app).post('/api/auth/login').send({ email: 'admin@company.com', password: 'password' });
    const auth = { Authorization: `Bearer ${directorLogin.body.data.token}` };
    const reset = await request(app).post(`/api/employees/${employee.id}/reset-password`).set(auth);
    expect(reset.status).toBe(200);
    expect(reset.body.temporaryPassword).toBeTruthy();
    // Old session is gone; the new temporary password works and is flagged.
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    const relogin = await request(app).post('/api/auth/login').send({ email: employee.email, password: reset.body.temporaryPassword });
    expect(relogin.body.data.user.mustChangePassword).toBe(true);

    const revoke = await request(app).post(`/api/employees/${employee.id}/revoke-access`).set(auth);
    expect(revoke.status).toBe(200);
    expect(revoke.body.data.hasLogin).toBe(false);
    const blocked = await request(app).post('/api/auth/login').send({ email: employee.email, password: reset.body.temporaryPassword });
    expect(blocked.status).toBe(401);
  });

  it('keeps the user signed in when the current password is mistyped', async () => {
    const { employee, temporaryPassword } = await newLogin();
    const login = await request(app).post('/api/auth/login').send({ email: employee.email, password: temporaryPassword });
    const res = await request(app).patch('/api/auth/change-password').set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'another-password-1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Incorrect current password');
  });

  it('never removes, demotes or revokes the last Director', async () => {
    // Make admin@company.com the only active Director for this check.
    const others = (await pool.query(
      "SELECT id FROM employees WHERE role_id = 1 AND deleted_at IS NULL AND email <> 'admin@company.com'"
    )).rows.map((row) => row.id);
    await pool.query('UPDATE employees SET deleted_at = NOW() WHERE id = ANY($1)', [others]);
    try {
      await expect(employeeService.updateEmployeeRole(director.id, 4, director)).rejects.toMatchObject({ statusCode: 409 });
      await expect(employeeService.revokeEmployeeAccess(director.id, director)).rejects.toMatchObject({ statusCode: 409 });
      await expect(employeeService.deleteEmployee(director.id, director)).rejects.toMatchObject({ statusCode: 409 });
    } finally {
      await pool.query('UPDATE employees SET deleted_at = NULL WHERE id = ANY($1)', [others]);
    }
  });
});

describe('asset and ticket rules', () => {
  it('refuses to hard-delete an asset someone is using', async () => {
    const { employee } = await newLogin();
    const asset = await newAsset();
    await assetService.assignAsset(asset.id, employee.id, null, null);
    await expect(assetService.deleteAsset(asset.id, true)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("shows only a Director's own tickets under My Tickets and locks the fulfilling asset", async () => {
    const { employee } = await newLogin();
    const theirs = await ticketService.createTicket({ id: employee.id, role: 'employee' }, { type: 'request', title: 'Theirs', description: 'x', targetAdminType: 'it' });
    created.tickets.push(theirs.id);
    const mine = await ticketService.getTickets(director, { scope: 'my_tickets' });
    expect(mine.some((ticket) => ticket.id === theirs.id)).toBe(false);

    const [first, second] = [await newAsset(), await newAsset()];
    await ticketService.updateTicket(theirs.id, { status: 'resolved', resolvedAssetId: first.id }, director);
    await expect(ticketService.updateTicket(theirs.id, { status: 'resolved', resolvedAssetId: second.id }, director))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('lets a ticket resolver list available stock without inventory access', async () => {
    const itAdmin = await request(app).post('/api/auth/login').send({ email: 'itadmin@company.com', password: 'password' });
    const res = await request(app).get('/api/assets/available').set('Authorization', `Bearer ${itAdmin.body.data.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((asset) => asset.serialNumber && !('costCents' in asset))).toBe(true);
    const employee = await request(app).post('/api/auth/login').send({ email: 'employee@company.com', password: 'password' });
    expect((await request(app).get('/api/assets/available').set('Authorization', `Bearer ${employee.body.data.token}`)).status).toBe(403);
  });
});
