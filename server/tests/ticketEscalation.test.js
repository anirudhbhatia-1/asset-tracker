import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import { runEscalations } from '../services/ticketEscalationService';

const ticketIds = [];
const headers = {};

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  return { Authorization: `Bearer ${res.body.data.token}` };
};

beforeAll(async () => {
  headers.employee = await login('employee@company.com');
  headers.it = await login('itadmin@company.com');
  headers.hardware = await login('hardwareadmin@company.com');
  headers.hr = await login('hr@company.com');
  headers.director = await login('admin@company.com');
});
afterAll(async () => {
  await pool.query('DELETE FROM ticket_history WHERE ticket_id = ANY($1)', [ticketIds]);
  await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [ticketIds]);
});

const raise = async (body) => {
  const res = await request(app).post('/api/tickets').set(headers.employee)
    .send({ type: 'issue', title: `Escalation test ${Date.now()}`, targetAdminType: 'it', priority: 'urgent', ...body });
  expect(res.status).toBe(201);
  ticketIds.push(res.body.data.id);
  return res.body.data;
};

// Pretend the ticket has been waiting in its current queue for `minutes`.
const wait = (id, minutes) => pool.query(
  "UPDATE tickets SET queue_entered_at = NOW() - make_interval(mins => $2) WHERE id = $1", [id, minutes]
);
const escalate = async (id) => (await runEscalations()).filter((step) => step.id === id);
const ticket = async (id) => (await pool.query('SELECT * FROM tickets WHERE id = $1', [id])).rows[0];
const notificationIds = async (who) => (await request(app).get('/api/notifications').set(headers[who])).body.data.map((n) => n.id);

describe('unattended urgent tickets', () => {
  it('waits the full 10 minutes', async () => {
    const t = await raise({});
    await wait(t.id, 9);
    expect(await escalate(t.id)).toEqual([]);
    expect((await ticket(t.id)).current_admin_type).toBe('it');
  });

  it('moves IT Admin -> Admin once, then alerts Directors, then stops', async () => {
    const t = await raise({});
    await wait(t.id, 11);
    expect(await escalate(t.id)).toEqual([{ id: t.id, action: 'moved', to: 'hardware' }]);
    let row = await ticket(t.id);
    expect(row).toMatchObject({ current_admin_type: 'hardware', escalation_stage: 'moved', status: 'open' });

    const { rows: history } = await pool.query(
      "SELECT performed_by, from_admin_type, to_admin_type, note FROM ticket_history WHERE ticket_id = $1 AND event_type = 'transferred'", [t.id]
    );
    expect(history).toEqual([expect.objectContaining({ performed_by: null, from_admin_type: 'it', to_admin_type: 'hardware' })]);
    expect(history[0].note).toMatch(/Moved automatically: urgent priority ticket not picked up by IT Admin within 10 minutes/);
    expect(await notificationIds('hardware')).toEqual(expect.arrayContaining([expect.stringContaining(`admin-ticket-transfer-${t.id}-`)]));

    // The clock restarted on the move.
    expect(await escalate(t.id)).toEqual([]);
    await wait(t.id, 11);
    expect(await escalate(t.id)).toEqual([{ id: t.id, action: 'directors_alerted' }]);
    row = await ticket(t.id);
    expect(row).toMatchObject({ current_admin_type: 'hardware', escalation_stage: 'directors_alerted' });
    expect(await notificationIds('director')).toContain(`ticket-escalated-${t.id}`);

    // Nothing more happens, however long it waits.
    await wait(t.id, 120);
    expect(await escalate(t.id)).toEqual([]);

    // Picking it up clears the Director alert.
    await request(app).patch(`/api/tickets/${t.id}`).set(headers.hardware).send({ status: 'in_progress' }).expect(200);
    expect(await notificationIds('director')).not.toContain(`ticket-escalated-${t.id}`);
  });

  it('moves Admin -> IT Admin too', async () => {
    const t = await raise({ targetAdminType: 'hardware', priority: 'high' });
    await wait(t.id, 11);
    expect(await escalate(t.id)).toEqual([{ id: t.id, action: 'moved', to: 'it' }]);
  });

  it('tells the employee to contact management when HR does not pick it up', async () => {
    const t = await raise({ targetAdminType: 'hr' });
    await wait(t.id, 11);
    expect(await escalate(t.id)).toEqual([{ id: t.id, action: 'employee_notified' }]);
    expect(await ticket(t.id)).toMatchObject({ current_admin_type: 'hr', escalation_stage: 'employee_notified' });
    const res = await request(app).get('/api/notifications').set(headers.employee);
    const note = res.body.data.find((n) => n.id === `ticket-hr-unanswered-${t.id}`);
    expect(note.message).toMatch(/contact management/);

    await wait(t.id, 60);
    expect(await escalate(t.id)).toEqual([]);
  });

  it('leaves low/medium tickets and tickets already in progress alone', async () => {
    const medium = await raise({ priority: 'medium' });
    const started = await raise({});
    await request(app).patch(`/api/tickets/${started.id}`).set(headers.it).send({ status: 'in_progress' }).expect(200);
    await wait(medium.id, 30);
    await wait(started.id, 30);
    expect(await escalate(medium.id)).toEqual([]);
    expect(await escalate(started.id)).toEqual([]);
  });

  it('restarts the clock when a ticket is raised to urgent or transferred', async () => {
    const raised = await raise({ priority: 'low' });
    await wait(raised.id, 30);
    await request(app).patch(`/api/tickets/${raised.id}`).set(headers.it).send({ priority: 'urgent' }).expect(200);
    expect(await escalate(raised.id)).toEqual([]);

    const moved = await raise({});
    await wait(moved.id, 30);
    await request(app).patch(`/api/tickets/${moved.id}/transfer`).set(headers.it).send({ targetAdminType: 'hardware' }).expect(200);
    expect(await escalate(moved.id)).toEqual([]);
  });
});
