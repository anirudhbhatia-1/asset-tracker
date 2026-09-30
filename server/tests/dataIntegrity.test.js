import { afterEach, describe, expect, it } from 'vitest';

import * as assetService from '../services/assetService';
import onboardingService from '../services/onboardingService';
import { pool } from '../db';

const created = { assets: [], employees: [], requests: [] };
const newAsset = async (extra = {}) => {
  const asset = await assetService.createAsset({
    name: 'Integrity Test Asset',
    serialNumber: `INTEG-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    categoryId: 1,
    status: 'available',
    ...extra,
  });
  created.assets.push(asset.id);
  return asset;
};
const employeeIds = async () => {
  const { rows } = await pool.query("SELECT id FROM employees WHERE deleted_at IS NULL AND email LIKE '%@company.com' ORDER BY id LIMIT 2");
  return rows.map((row) => row.id);
};
const eventsFor = async (assetId) => {
  const { rows } = await pool.query('SELECT event_type, employee_id FROM asset_history WHERE asset_id = $1 ORDER BY id', [assetId]);
  return rows.map((row) => `${row.event_type}:${row.employee_id ?? ''}`);
};

afterEach(async () => {
  await pool.query('DELETE FROM onboarding_request_items WHERE onboarding_request_id = ANY($1)', [created.requests]);
  await pool.query('DELETE FROM onboarding_requests WHERE id = ANY($1)', [created.requests]);
  await pool.query('DELETE FROM assets WHERE id = ANY($1)', [created.assets]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
  created.assets = []; created.employees = []; created.requests = [];
});

describe('asset audit trail', () => {
  it('keeps history, including the deleted event, after an asset is deleted', async () => {
    const asset = await newAsset();
    await assetService.deleteAsset(asset.id, true);
    const { rows } = await pool.query(
      "SELECT asset_id, note FROM asset_history WHERE event_type = 'deleted' AND note LIKE $1",
      [`%${asset.serialNumber}%`]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].asset_id).toBeNull();
    await pool.query('DELETE FROM asset_history WHERE asset_id IS NULL AND note LIKE $1', [`%${asset.serialNumber}%`]);
  });

  it('records the previous holder returning it when an asset is reassigned', async () => {
    const [first, second] = await employeeIds();
    const asset = await newAsset();
    await assetService.assignAsset(asset.id, first, null, null);
    await expect(assetService.assignAsset(asset.id, first, null, null)).rejects.toMatchObject({ statusCode: 400 });
    await assetService.assignAsset(asset.id, second, null, null);
    expect(await eventsFor(asset.id)).toEqual(['created:', `assigned:${first}`, `returned:${first}`, `assigned:${second}`]);
  });

  it('releases accessories still with the holder when their laptop is retired', async () => {
    const [holder] = await employeeIds();
    const laptop = await newAsset();
    const adaptor = await newAsset({ name: 'Integrity Test Adaptor' });
    await pool.query('UPDATE assets SET parent_id = $1 WHERE id = $2', [laptop.id, adaptor.id]);
    await assetService.assignAsset(laptop.id, holder, null, null);
    expect((await assetService.getAssetById(adaptor.id)).status).toBe('in-use');

    await assetService.retireAsset(laptop.id, null, true);
    const releasedAdaptor = await assetService.getAssetById(adaptor.id);
    expect(releasedAdaptor.status).toBe('available');
    expect(releasedAdaptor.assignedTo).toBeNull();
  });
});

describe('onboarding fulfilment', () => {
  it('assigns fulfilled assets to the new hire once their employee record exists', async () => {
    const [requester] = await employeeIds();
    const email = `new.hire.${Date.now()}@company.com`;
    const request = await onboardingService.createRequest({ id: requester }, {
      newHireName: 'New Hire', newHireEmail: email, joiningDate: '2026-10-15', items: [{ categoryId: 1, quantity: 1 }],
    });
    created.requests.push(request.id);
    const asset = await newAsset();

    // Fulfilled before the new hire has a record: reserved on the request only.
    await onboardingService.fulfillItem(request.id, request.items[0].id, asset.id);
    expect((await assetService.getAssetById(asset.id)).status).toBe('available');

    const { rows: [employee] } = await pool.query(
      "INSERT INTO employees (name, email) VALUES ('New Hire', $1) RETURNING id, email", [email]
    );
    created.employees.push(employee.id);
    await onboardingService.assignFulfilledItemsToEmployee(employee);

    const assigned = await assetService.getAssetById(asset.id);
    expect(assigned.status).toBe('in-use');
    expect(assigned.assignedTo).toBe(employee.id);
    expect((await onboardingService.getRequestById(request.id)).linked_employee_id).toBe(employee.id);
  });
});

describe('asset timeline tickets', () => {
  it('lists tickets raised about an asset', async () => {
    const ticketService = (await import('../services/ticketService')).default;
    const asset = await newAsset();
    const { rows: [employee] } = await pool.query("SELECT id FROM employees WHERE email = 'employee@company.com'");
    const ticket = await ticketService.createTicket({ id: employee.id, role: 'employee' }, {
      type: 'issue', title: 'Screen flickers', description: 'x', assetId: asset.id, targetAdminType: 'hardware',
    });
    try {
      const tickets = await ticketService.getTicketsForAsset(asset.id);
      expect(tickets.map((t) => t.id)).toEqual([ticket.id]);
      expect(tickets[0].human_readable_id).toBe(`TK-${String(ticket.id).padStart(4, '0')}`);
    } finally {
      await pool.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);
    }
  });
});
