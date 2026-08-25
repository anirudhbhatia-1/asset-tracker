import express from 'express';
import { createRequire } from 'node:module';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isGoogleAuthConfigured,
  normalizeAllowedDomain,
  validateGooglePayload,
  verifyGoogleIdToken,
  loginWithGoogle,
} from '../services/googleService';

const require = createRequire(import.meta.url);
const googleService = require('../services/googleService');
const googleRouter = require('../routes/google');
const { createGoogleLoginLimiter } = googleRouter;

const originalLoginWithGoogle = googleService.loginWithGoogle;
const originalNodeEnv = process.env.NODE_ENV;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;

afterEach(() => {
  googleService.loginWithGoogle = originalLoginWithGoogle;
  process.env.NODE_ENV = originalNodeEnv;
  process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  vi.restoreAllMocks();
});

describe('Google authentication configuration', () => {
  it('allows production Google login when a real client ID is configured', () => {
    expect(isGoogleAuthConfigured({
      NODE_ENV: 'production',
      GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
      GOOGLE_ALLOWED_DOMAIN: 'company.com',
    })).toBe(true);
  });

  it.each([{}, { GOOGLE_CLIENT_ID: '' }, { GOOGLE_CLIENT_ID: 'your-google-client-id.apps.googleusercontent.com' }])(
    'rejects missing or placeholder Google configuration',
    (environment) => {
      expect(isGoogleAuthConfigured(environment)).toBe(false);
    },
  );

  it('fails closed in production when no Workspace domain or explicit external-account opt-in exists', () => {
    expect(isGoogleAuthConfigured({
      NODE_ENV: 'production',
      GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    })).toBe(false);

    expect(isGoogleAuthConfigured({
      NODE_ENV: 'production',
      GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
      GOOGLE_ALLOW_EXTERNAL_ACCOUNTS: 'true',
    })).toBe(true);
  });

  it.each(['@', '   ', 'https://company.com', 'company', '-company.com', 'company..com'])(
    'rejects malformed Workspace domains (%s)',
    (domain) => {
      expect(normalizeAllowedDomain(domain)).toBe('');
      expect(isGoogleAuthConfigured({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
        GOOGLE_ALLOWED_DOMAIN: domain,
      })).toBe(false);
    },
  );

  it('normalizes a valid Workspace domain with an optional at-sign', () => {
    expect(normalizeAllowedDomain(' @Company.COM ')).toBe('company.com');
  });

  it('allows configured Google auth without a domain outside production', () => {
    expect(isGoogleAuthConfigured({
      NODE_ENV: 'development',
      GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    })).toBe(true);
  });
});

describe('Google identity validation', () => {
  it('accepts a verified email and normalizes it', () => {
    expect(validateGooglePayload({ email: 'Employee@Company.com', email_verified: true }, '')).toBe(
      'employee@company.com',
    );
  });

  it('rejects an unverified Google email', () => {
    expect(() => validateGooglePayload({ email: 'employee@company.com', email_verified: false })).toThrow(
      'verified email',
    );
  });

  it('enforces the configured Workspace domain', () => {
    expect(() => validateGooglePayload(
      { email: 'employee@gmail.com', email_verified: true, hd: undefined },
      'company.com',
    )).toThrow('company.com');

    expect(validateGooglePayload(
      { email: 'employee@company.com', email_verified: true, hd: 'company.com' },
      'company.com',
    )).toBe('employee@company.com');
  });

  it('rejects a mismatched hosted-domain claim even when the email suffix matches', () => {
    expect(() => validateGooglePayload(
      { email: 'employee@company.com', email_verified: true, hd: 'other-company.com' },
      'company.com',
    )).toThrow('company.com');
  });

  it('returns a service-unavailable error before token verification when configuration is missing', async () => {
    process.env.GOOGLE_CLIENT_ID = '';
    await expect(verifyGoogleIdToken('credential')).rejects.toMatchObject({ statusCode: 503 });
  });

  it('verifies the token audience and returns the validated email', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      getPayload: () => ({ email: 'Employee@Company.com', email_verified: true, hd: 'company.com' }),
    });
    const environment = {
      NODE_ENV: 'production',
      GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
      GOOGLE_ALLOWED_DOMAIN: 'company.com',
    };

    await expect(verifyGoogleIdToken('credential', {
      environment,
      oauthClient: { verifyIdToken },
    })).resolves.toBe('employee@company.com');
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'credential',
      audience: environment.GOOGLE_CLIENT_ID,
    });
  });

  it('maps token verification failures to 401', async () => {
    await expect(verifyGoogleIdToken('expired', {
      environment: { GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com' },
      oauthClient: { verifyIdToken: vi.fn().mockRejectedValue(new Error('bad token')) },
    })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('preserves typed identity-policy errors', async () => {
    await expect(verifyGoogleIdToken('credential', {
      environment: { GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com' },
      oauthClient: {
        verifyIdToken: vi.fn().mockResolvedValue({
          getPayload: () => ({ email: 'employee@company.com', email_verified: false }),
        }),
      },
    })).rejects.toMatchObject({ statusCode: 401, message: expect.stringContaining('verified email') });
  });

  it('creates a session only for an approved active employee', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 42 }] });
    const createSession = vi.fn().mockResolvedValue({ token: 'session-token' });

    await expect(loginWithGoogle('credential', {
      verifyToken: vi.fn().mockResolvedValue('employee@company.com'),
      pool: { query },
      createSession,
    })).resolves.toEqual({ token: 'session-token' });

    expect(query.mock.calls[0][0]).toContain('deleted_at IS NULL');
    expect(query.mock.calls[0][0]).toContain('role IS NOT NULL');
    expect(createSession).toHaveBeenCalledWith(42);
  });

  it('rejects an employee who has not been granted access', async () => {
    await expect(loginWithGoogle('credential', {
      verifyToken: vi.fn().mockResolvedValue('employee@company.com'),
      pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
      createSession: vi.fn(),
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('propagates database and session-creation failures', async () => {
    const verifyToken = vi.fn().mockResolvedValue('employee@company.com');
    await expect(loginWithGoogle('credential', {
      verifyToken,
      pool: { query: vi.fn().mockRejectedValue(new Error('database unavailable')) },
    })).rejects.toThrow('database unavailable');

    await expect(loginWithGoogle('credential', {
      verifyToken,
      pool: { query: vi.fn().mockResolvedValue({ rows: [{ id: 42 }] }) },
      createSession: vi.fn().mockRejectedValue(new Error('session insert failed')),
    })).rejects.toThrow('session insert failed');
  });
});

describe('Google login route', () => {
  it('remains available when the server runs in production', async () => {
    process.env.NODE_ENV = 'production';
    googleService.loginWithGoogle = vi.fn().mockResolvedValue({
      token: 'session-token',
      user: { id: 1, email: 'employee@company.com' },
    });

    const app = express();
    app.use(express.json());
    app.use('/api/google', googleRouter);
    app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));

    const response = await request(app)
      .post('/api/google/login')
      .send({ credential: 'verified-id-token' });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBe('session-token');
    expect(googleService.loginWithGoogle).toHaveBeenCalledWith('verified-id-token');
  });

  it('rejects missing and oversized credentials before calling the Google service', async () => {
    googleService.loginWithGoogle = vi.fn();
    const app = express();
    app.use(express.json());
    app.use('/api/google', googleRouter);

    expect((await request(app).post('/api/google/login').send({})).status).toBe(400);
    expect((await request(app).post('/api/google/login').send({ credential: 'x'.repeat(4097) })).status).toBe(400);
    expect(googleService.loginWithGoogle).not.toHaveBeenCalled();
  });

  it('forwards Google service authentication failures', async () => {
    googleService.loginWithGoogle = vi.fn().mockRejectedValue(
      Object.assign(new Error('Invalid or expired Google credential'), { statusCode: 401 }),
    );
    const app = express();
    app.use(express.json());
    app.use('/api/google', googleRouter);
    app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));

    const response = await request(app)
      .post('/api/google/login')
      .send({ credential: 'expired-token' });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('expired');
  });

  it('counts failed attempts but does not lock an office out after successful sign-ins', async () => {
    const successfulApp = express();
    successfulApp.use('/limited', createGoogleLoginLimiter({ limit: 2 }), (req, res) => res.sendStatus(204));
    expect((await request(successfulApp).get('/limited')).status).toBe(204);
    expect((await request(successfulApp).get('/limited')).status).toBe(204);
    expect((await request(successfulApp).get('/limited')).status).toBe(204);

    const failingApp = express();
    failingApp.use('/limited', createGoogleLoginLimiter({ limit: 2 }), (req, res) => res.sendStatus(401));
    expect((await request(failingApp).get('/limited')).status).toBe(401);
    expect((await request(failingApp).get('/limited')).status).toBe(401);
    expect((await request(failingApp).get('/limited')).status).toBe(429);
  });
});
