import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { pool } from '../db';
import { hashSessionToken } from '../services/sessionToken';

const EMPLOYEE_TOKEN = 'test_employee_token_cat';

describe('Category & Location Permission Integration Tests', () => {
  let adminToken;
  let employeeToken;

  beforeAll(async () => {
    // Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@company.com', password: 'password' });
    adminToken = adminRes.body?.data?.token;

    // Create standard employee session token for testing
    const empRes = await pool.query("SELECT id, email FROM employees WHERE role = 'employee' LIMIT 1");
    if (empRes.rows.length > 0) {
      const emp = empRes.rows[0];
      // Sessions store a hash; the client presents the raw token.
      await pool.query(
        "INSERT INTO sessions (token, employee_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')",
        [hashSessionToken(EMPLOYEE_TOKEN), emp.id]
      );
      employeeToken = EMPLOYEE_TOKEN;
    }
  });

  afterAll(async () => {
    if (employeeToken) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [hashSessionToken(EMPLOYEE_TOKEN)]);
    }
  });

  it('GET /api/categories should be accessible with categories:read', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/categories should fail with 403 for employee without categories:manage', async () => {
    // The employee session must exist, or these checks would pass vacuously.
    expect(employeeToken).toBeTruthy();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'Unauthorized Category' });
    expect(res.status).toBe(403);
  });

  it('GET /api/locations should be accessible with locations:read', async () => {
    const res = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/locations should fail with 403 for employee without locations:manage', async () => {
    // The employee session must exist, or these checks would pass vacuously.
    expect(employeeToken).toBeTruthy();
    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'Unauthorized Location' });
    expect(res.status).toBe(403);
  });
});
