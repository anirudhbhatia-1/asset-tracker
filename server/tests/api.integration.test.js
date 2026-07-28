import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('API Integration Tests', () => {
  let testAssetId;
  let adminToken;
  const uniqueSerial = `INT-SN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@company.com', password: 'password' });
    adminToken = res.body?.data?.token;
  });

  it('POST /api/assets should validate required fields and create asset', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Integration Test MacBook Pro',
        serialNumber: uniqueSerial,
        categoryId: 1,
        status: 'available',
        purchaseDate: '2026-07-01',
        costCents: 249900,
        location: 'Bangalore',
        notes: 'Integration verification'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Integration Test MacBook Pro');
    expect(res.body.data.serialNumber).toBe(uniqueSerial);
    testAssetId = res.body.data.id;
  });

  it('GET /api/assets/:id should return full asset object with history array', async () => {
    const res = await request(app)
      .get(`/api/assets/${testAssetId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(testAssetId);
    expect(res.body.data.name).toBe('Integration Test MacBook Pro');
    expect(Array.isArray(res.body.data.history)).toBe(true);
    expect(res.body.data.history.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/assets/:id/assign should assign asset and return updated status', async () => {
    const res = await request(app)
      .post(`/api/assets/${testAssetId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId: 1,
        assignedDate: '2026-07-22',
        note: 'Assigned via integration test'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in-use');
    expect(res.body.data.assignedTo).toBe(1);

    // Verify GET /api/assets/:id shows updated assignee
    const getRes = await request(app)
      .get(`/api/assets/${testAssetId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.assignee).toBeDefined();
    expect(getRes.body.data.assignee.id).toBe(1);
  });

  it('POST /api/assets should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notes: 'Missing required fields'
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });
});
