import { afterEach, describe, expect, it, vi } from 'vitest';
import errorHandler from '../middleware/errorHandler';

const respond = (err) => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(err, {}, res, () => {});
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe('error handler', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  it('maps database input errors to 4xx without leaking internals', () => {
    const invalidId = Object.assign(new Error('invalid input syntax for type integer: "abc"'), { code: '22P02' });
    expect(respond(invalidId)).toMatchObject({ status: 400, body: { message: 'A value has the wrong format.' } });
    const duplicate = Object.assign(new Error('duplicate key value violates unique constraint "assets_serial_number_key"'), { code: '23505' });
    expect(respond(duplicate).status).toBe(409);
  });

  it('turns a deadlock or serialization failure into a "try again" 409', () => {
    for (const code of ['40P01', '40001']) {
      const res = respond(Object.assign(new Error('deadlock detected'), { code }));
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/try again/);
    }
  });

  it('keeps explicit status codes, messages and details', () => {
    const err = Object.assign(new Error('Return 1 assigned asset(s)'), { statusCode: 409, details: { assets: [{ id: 1 }] } });
    expect(respond(err)).toMatchObject({ status: 409, body: { message: 'Return 1 assigned asset(s)', details: { assets: [{ id: 1 }] } } });
  });

  it('passes a reason code through only as a string on a 4xx', () => {
    expect(respond(Object.assign(new Error('Locked'), { statusCode: 423, reason: 'ACCOUNT_LOCKED' })).body.reason).toBe('ACCOUNT_LOCKED');
    expect(respond(Object.assign(new Error('x'), { statusCode: 400, reason: { sql: 'SELECT' } })).body).not.toHaveProperty('reason');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const internal = Object.assign(new Error('boom'), { reason: 'ECONNRESET at 10.0.0.5:5432' });
    expect(respond(internal).body).not.toHaveProperty('reason');
    expect(respond(Object.assign(new Error('x'), { statusCode: 503, reason: 'DB_DOWN' })).body).not.toHaveProperty('reason');
  });

  it('hides unexpected error messages in production', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    expect(respond(new Error('relation "x" does not exist')).body.message).toBe('Something went wrong. Please try again.');
  });
});
