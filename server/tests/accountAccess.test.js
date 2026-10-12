import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import employeeService from '../services/employeeService';
import googleService from '../services/googleService';

const createdIds = [];
afterAll(async () => {
  await pool.query('DELETE FROM sessions WHERE employee_id = ANY($1)', [createdIds]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [createdIds]);
});

const director = { id: 0, role: 'director', isDirector: true, permissions: ['*'] };
const uniqueEmail = (prefix) => `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@thinkvibes.com`;

describe('login access is explicit', () => {
  it('does not let a directory-only employee sign in with Google until access is granted', async () => {
    const email = uniqueEmail('directory.only');
    const employee = await employeeService.createEmployee({ name: 'Directory Only', email, googleId: 'forged-google-id' });
    createdIds.push(employee.id);
    expect(employee.role).toBeNull();
    expect(employee.hasLogin).toBe(false);
    expect(employee.googleId).toBeNull();

    const loginWithGoogle = () => googleService.loginWithGoogle('token', { verifyToken: async () => email });
    await expect(loginWithGoogle()).rejects.toMatchObject({ statusCode: 403 });

    await employeeService.grantEmployeeAccess(employee.id, 'employee', 'unused-hash', director);
    await expect(loginWithGoogle()).resolves.toMatchObject({ token: expect.any(String) });
  });
});

describe('forced password change', () => {
  it('blocks the app until a temporary password is replaced', async () => {
    const email = uniqueEmail('temp.password');
    const { employee, temporaryPassword } = await employeeService.createEmployeeWithAccess(
      { name: 'Temp Password', email }, director,
    );
    createdIds.push(employee.id);

    // Email matching ignores case.
    const login = await request(app).post('/api/auth/login').send({ email: email.toUpperCase(), password: temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);
    const auth = { Authorization: `Bearer ${login.body.data.token}` };

    const blocked = await request(app).get('/api/tickets').set(auth);
    expect(blocked.status).toBe(403);
    expect(blocked.body.reason).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(200);

    const sameAgain = await request(app).patch('/api/auth/change-password').set(auth)
      .send({ currentPassword: temporaryPassword, newPassword: temporaryPassword });
    expect(sameAgain.status).toBe(400);

    const changed = await request(app).patch('/api/auth/change-password').set(auth)
      .send({ currentPassword: temporaryPassword, newPassword: 'orbit-lantern-cascade-42' });
    expect(changed.status).toBe(200);

    const relogin = await request(app).post('/api/auth/login').send({ email, password: 'orbit-lantern-cascade-42' });
    expect(relogin.body.data.user.mustChangePassword).toBe(false);
    const allowed = await request(app).get('/api/tickets').set('Authorization', `Bearer ${relogin.body.data.token}`);
    expect(allowed.status).toBe(200);
  });

  it('rejects unknown emails with the same message as a wrong password', async () => {
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody.here@thinkvibes.com', password: 'whatever1' });
    const wrong = await request(app).post('/api/auth/login').send({ email: 'employee@company.com', password: 'wrong-password' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.message).toBe(wrong.body.message);
  });
});
