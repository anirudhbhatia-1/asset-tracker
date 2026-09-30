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

  it('keeps explicit status codes, messages and details', () => {
    const err = Object.assign(new Error('Return 1 assigned asset(s)'), { statusCode: 409, details: { assets: [{ id: 1 }] } });
    expect(respond(err)).toMatchObject({ status: 409, body: { message: 'Return 1 assigned asset(s)', details: { assets: [{ id: 1 }] } } });
  });

  it('hides unexpected error messages in production', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    expect(respond(new Error('relation "x" does not exist')).body.message).toBe('Something went wrong. Please try again.');
  });
});
