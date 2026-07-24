import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as assetService from '../services/assetService';

describe('assetService Unit Tests', () => {
  let createdAssetId;

  beforeEach(async () => {
    const res = await assetService.createAsset({
      name: 'Test Unit Asset',
      serialNumber: `TEST-SN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      categoryId: 1,
      status: 'available',
      purchaseDate: '2026-01-01',
      costCents: 99999,
      location: 'Bangalore',
      notes: 'Initial test note'
    });
    createdAssetId = res.id;
  });

  afterEach(async () => {
    if (createdAssetId) {
      try {
        await assetService.deleteAsset(createdAssetId, true);
      } catch (e) {}
    }
  });

  it('createAsset should create a new asset record and log created event', async () => {
    const asset = await assetService.getAssetById(createdAssetId);
    expect(asset).toBeDefined();
    expect(asset.name).toBe('Test Unit Asset');
    expect(asset.status).toBe('available');
    expect(asset.history.length).toBeGreaterThanOrEqual(1);
    expect(asset.history[0].eventType).toBe('created');
  });

  it('assignAsset should update status to in-use and record assignee', async () => {
    const updated = await assetService.assignAsset(createdAssetId, 1, '2026-07-22', 'Assigned to John');
    expect(updated.status).toBe('in-use');
    expect(updated.assignedTo).toBe(1);

    const fullAsset = await assetService.getAssetById(createdAssetId);
    expect(fullAsset.assignee).toBeDefined();
    expect(fullAsset.assignee.id).toBe(1);
    const historyEvent = fullAsset.history.find(h => h.eventType === 'assigned');
    expect(historyEvent).toBeDefined();
    expect(historyEvent.note).toContain('Assigned to John');
  });

  it('returnAsset should set status back to available and clear assignee', async () => {
    await assetService.assignAsset(createdAssetId, 1, '2026-07-22', 'Assign before return');
    const returned = await assetService.returnAsset(createdAssetId, 'Returned to IT');
    expect(returned.status).toBe('available');
    expect(returned.assignedTo).toBeNull();

    const fullAsset = await assetService.getAssetById(createdAssetId);
    const historyEvent = fullAsset.history.find(h => h.eventType === 'returned');
    expect(historyEvent).toBeDefined();
  });

  it('retireAsset should transition asset status to retired', async () => {
    const retired = await assetService.retireAsset(createdAssetId, 'End of life', true);
    expect(retired.status).toBe('retired');

    const fullAsset = await assetService.getAssetById(createdAssetId);
    const historyEvent = fullAsset.history.find(h => h.eventType === 'retired');
    expect(historyEvent).toBeDefined();
  });

  it('retireAsset and assignAsset should throw or respect retired status rules', async () => {
    await assetService.retireAsset(createdAssetId, 'Retired', true);
    await expect(async () => {
      await assetService.assignAsset(createdAssetId, 1, '2026-07-22', 'Attempt assign');
    }).rejects.toThrow(/retired/i);
  });

  it('deleteAsset should hard delete asset and log deleted event when confirm is true', async () => {
    const tempSn = `DELETE-TEST-${Date.now()}`;
    const res = await assetService.createAsset({
      name: 'To Be Deleted',
      serialNumber: tempSn,
      categoryId: 1,
      status: 'available',
      purchaseDate: '2026-01-01',
      costCents: 10000,
      location: 'Delhi'
    });
    const delRes = await assetService.deleteAsset(res.id, true);
    expect(delRes.deleted).toBe(true);
    await expect(async () => await assetService.getAssetById(res.id)).rejects.toThrow('Asset not found');
  });
});
