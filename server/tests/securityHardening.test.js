import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import authRouter from '../routes/auth';
import { hashSessionToken } from '../services/sessionToken';
import employeeService from '../services/employeeService';
import ticketService from '../services/ticketService';
import { pool } from '../db';

describe('session tokens', () => {
  it('stores only a SHA-256 fingerprint of the token', () => {
    const hash = hashSessionToken('abc');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('abc');
    expect(hashSessionToken('abc')).toBe(hash);
  });

  it('logs in with a token that works, while the database holds only its hash', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@company.com', password: 'password' });
    expect(login.status).toBe(200);
    const { token } = login.body.data;

    const { rows } = await pool.query('SELECT token FROM sessions WHERE token = $1 OR token = $2', [token, hashSessionToken(token)]);
    expect(rows.map((row) => row.token)).toEqual([hashSessionToken(token)]);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    const afterLogout = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(afterLogout.status).toBe(401);
  });
});

describe('password login rate limit', () => {
  it('blocks repeated failures from one address but not successful logins', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', (req, res, next) => next(), authRouter.createPasswordLoginLimiter({ limit: 2 }), (req, res) => {
      res.status(req.body.password === 'right' ? 200 : 401).json({});
    });

    expect((await request(app).post('/api/auth/login').send({ password: 'right' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ password: 'wrong' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ password: 'wrong' })).status).toBe(401);
    const blocked = await request(app).post('/api/auth/login').send({ password: 'wrong' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain('Too many failed login attempts');
  });
});

describe('login email domains', () => {
  it('defaults to company.com and thinkvibes.com and reads LOGIN_EMAIL_DOMAINS', () => {
    expect(employeeService.getLoginEmailDomains({})).toEqual(['company.com', 'thinkvibes.com']);
    expect(employeeService.getLoginEmailDomains({ LOGIN_EMAIL_DOMAINS: ' @Example.org , thinkvibes.com ' }))
      .toEqual(['example.org', 'thinkvibes.com']);
  });
});

describe('ticket updates', () => {
  const createTicket = async (queue) => {
    const { rows: [employee] } = await pool.query("SELECT id FROM employees WHERE email = 'employee@company.com'");
    const ticket = await ticketService.createTicket({ id: employee.id, role: 'employee' }, {
      type: 'issue', title: 'Security test ticket', description: 'x', targetAdminType: queue,
    });
    return ticket;
  };
  const cleanup = (id) => pool.query('DELETE FROM tickets WHERE id = $1', [id]);

  it('rejects updates from outside the ticket queue', async () => {
    const ticket = await createTicket('hardware');
    try {
      const itAdmin = { id: 1, role: 'admin', adminType: 'it', permissions: ['tickets:update', 'tickets:resolve'] };
      await expect(ticketService.updateTicket(ticket.id, { status: 'in_progress' }, itAdmin))
        .rejects.toMatchObject({ statusCode: 403 });
    } finally {
      await cleanup(ticket.id);
    }
  });

  it('requires tickets:resolve to resolve, but allows progress updates in the queue', async () => {
    const ticket = await createTicket('it');
    try {
      const updater = { id: 1, role: 'admin', adminType: 'it', permissions: ['tickets:update'] };
      await expect(ticketService.updateTicket(ticket.id, { status: 'resolved' }, updater))
        .rejects.toMatchObject({ statusCode: 403 });
      const updated = await ticketService.updateTicket(ticket.id, { status: 'in_progress' }, updater);
      expect(updated.status).toBe('in_progress');
    } finally {
      await cleanup(ticket.id);
    }
  });
});

describe('creating employees with a login', () => {
  it('requires employees:grant-access, not just employees:create', async () => {
    const { default: app } = await import('../index');
    const bcrypt = (await import('bcrypt')).default;
    const suffix = Date.now();
    // A throwaway role that may add directory entries but not create logins.
    const { rows: [role] } = await pool.query(
      "INSERT INTO roles (name, description) VALUES ($1, 'test') RETURNING id", [`Directory Clerk ${suffix}`]
    );
    await pool.query(
      "INSERT INTO role_permissions (role_id, permission_id) SELECT $1, id FROM permissions WHERE key IN ('employees:read', 'employees:create')",
      [role.id]
    );
    const email = `clerk.${suffix}@company.com`;
    const { rows: [clerk] } = await pool.query(
      "INSERT INTO employees (name, email, password_hash, role, role_id) VALUES ('Test Clerk', $1, $2, 'employee', $3) RETURNING id",
      [email, await bcrypt.hash('password', 4), role.id]
    );
    try {
      const login = await request(app).post('/api/auth/login').send({ email, password: 'password' });
      expect(login.status).toBe(200);
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${login.body.data.token}`)
        .send({ name: 'Should Not Exist', email: `blocked.${suffix}@thinkvibes.com`, grantAccess: true });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('employees:grant-access');
      const { rows } = await pool.query('SELECT id FROM employees WHERE email = $1', [`blocked.${suffix}@thinkvibes.com`]);
      expect(rows).toHaveLength(0);
    } finally {
      await pool.query('DELETE FROM sessions WHERE employee_id = $1', [clerk.id]);
      await pool.query('DELETE FROM employees WHERE id = $1', [clerk.id]);
      await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [role.id]);
      await pool.query('DELETE FROM roles WHERE id = $1', [role.id]);
    }
  });
});

describe('single ticket lookup', () => {
  it('shows a ticket to its owner and resolvers but hides it from other employees', async () => {
    const { rows: [owner] } = await pool.query("SELECT id FROM employees WHERE email = 'employee@company.com'");
    const ticket = await ticketService.createTicket({ id: owner.id, role: 'employee' }, {
      type: 'issue', title: 'Lookup test', description: 'x', targetAdminType: 'it',
    });
    try {
      const ownerView = await ticketService.getTicketById(ticket.id, { id: owner.id, role: 'employee', permissions: ['tickets:read'] });
      expect(ownerView.human_readable_id).toBe(`TK-${String(ticket.id).padStart(4, '0')}`);
      await expect(ticketService.getTicketById(ticket.id, { id: 1, role: 'admin', adminType: 'hardware', permissions: ['tickets:resolve'] }))
        .resolves.toMatchObject({ id: ticket.id });
      await expect(ticketService.getTicketById(ticket.id, { id: owner.id + 1000, role: 'employee', permissions: ['tickets:read'] }))
        .rejects.toMatchObject({ statusCode: 404 });
    } finally {
      await pool.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);
    }
  });
});
