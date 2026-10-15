import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';

const ticketIds = [];
let employee;
let itAdmin;

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  return { Authorization: `Bearer ${res.body.data.token}` };
};

beforeAll(async () => {
  employee = await login('employee@company.com');
  itAdmin = await login('itadmin@company.com');
});
afterAll(async () => {
  await pool.query('DELETE FROM ticket_history WHERE ticket_id = ANY($1)', [ticketIds]);
  await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [ticketIds]);
});

const raise = async (body) => {
  const res = await request(app).post('/api/tickets').set(employee).send({ type: 'issue', title: 'Priority test', targetAdminType: 'it', ...body });
  if (res.body?.data?.id) ticketIds.push(res.body.data.id);
  return res;
};

describe('ticket priority and typed-in requests', () => {
  it('defaults to medium and stores the chosen priority', async () => {
    expect((await raise({})).body.data.priority).toBe('medium');
    expect((await raise({ priority: 'urgent' })).body.data.priority).toBe('urgent');
    expect((await raise({ priority: 'critical' })).status).toBe(400);
  });

  it('stores a typed-in item for hardware requests only', async () => {
    const res = await raise({ type: 'request', title: 'Need a chair', requestedItem: '  Ergonomic chair  ' });
    expect(res.status).toBe(201);
    expect(res.body.data.requested_item).toBe('Ergonomic chair');
    const issue = await raise({ type: 'issue', requestedItem: 'ignored' });
    expect(issue.body.data.requested_item).toBeNull();
    expect((await raise({ type: 'request', requestedItem: 'x'.repeat(101) })).status).toBe(400);
  });

  it('lets the queue change the priority, and records it in the ticket history', async () => {
    const { body: { data: ticket } } = await raise({ priority: 'low' });
    const res = await request(app).patch(`/api/tickets/${ticket.id}`).set(itAdmin).send({ priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe('high');
    const { rows } = await pool.query("SELECT note FROM ticket_history WHERE ticket_id = $1 AND note LIKE 'Priority%'", [ticket.id]);
    expect(rows[0].note).toBe('Priority changed from low to high');
  });

  it('puts urgent tickets first in the queue and marks the card high', async () => {
    await raise({ priority: 'urgent', title: 'Urgent printer fire' });
    const res = await request(app).get('/api/dashboard/attention').set(itAdmin);
    const queue = res.body.data.items.find((item) => item.key === 'tickets_queue');
    expect(queue.severity).toBe('high');
    expect(queue.entries[0].sublabel).toMatch(/^Urgent · /);
  });
});
