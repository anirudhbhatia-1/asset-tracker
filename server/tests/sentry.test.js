// Sentry must never receive request bodies, cookies, auth headers, user
// details or IP addresses. Runs in its own file: Sentry.init is global.
import { createRequire } from 'module';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Loaded with Node's own require so the error handler and this test share
// one sentry module (and one initialised SDK).
const nodeRequire = createRequire(import.meta.url);
const sentry = nodeRequire('../sentry');
const errorHandler = nodeRequire('../middleware/errorHandler');

const SECRET = 'Hunter2-correct-horse';

describe('Sentry privacy', () => {
  it('sends a 5xx from POST /api/auth/login without the body, cookies, auth header, user or IP', async () => {
    const envelopes = [];
    const transport = () => ({
      send: async (envelope) => { envelopes.push(envelope); return {}; },
      flush: async () => true,
    });
    expect(sentry.initSentry(
      { SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0', NODE_ENV: 'test' },
      { transport, tracesSampleRate: 0 },
    )).toBe(true);

    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.post('/api/auth/login', () => { throw new Error('database exploded'); });
    app.use(errorHandler);

    const res = await request(app).post('/api/auth/login?token=abc123')
      .set('Authorization', 'Bearer session-secret-token')
      .set('Cookie', 'sid=cookie-secret')
      .set('X-Forwarded-For', '198.51.100.23')
      .send({ email: 'ravi@company.com', password: SECRET });
    expect(res.status).toBe(500);
    await sentry.flushSentry(2000);

    const events = envelopes.flatMap(([, items]) => items)
      .filter(([header]) => header.type === 'event')
      .map(([, payload]) => (typeof payload === 'string' ? JSON.parse(payload) : payload));
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.exception.values[0].value).toBe('database exploded');
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.user).toBeUndefined();
    // Stack frames carry this test file's own source lines (which contain
    // the values below); everything else must not.
    const serialized = JSON.stringify(envelopes, (key, value) => (key === 'stacktrace' ? undefined : value));
    expect(serialized).toContain('database exploded');
    for (const secret of [SECRET, 'session-secret-token', 'cookie-secret', '198.51.100.23', 'abc123', 'ravi@company.com']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('beforeSend strips a realistic event that carries everything', () => {
    const event = {
      event_id: 'x',
      request: {
        method: 'POST',
        url: 'https://assets.example.com/api/auth/login?token=abc',
        query_string: 'token=abc',
        data: { email: 'ravi@company.com', password: SECRET },
        cookies: { sid: 'cookie-secret' },
        headers: {
          'User-Agent': 'Mozilla/5.0', authorization: 'Bearer t0k3n', cookie: 'sid=cookie-secret',
          'x-forwarded-for': '198.51.100.23', 'Content-Type': 'application/json',
        },
        env: { REMOTE_ADDR: '198.51.100.23' },
      },
      user: { id: 7, email: 'ravi@company.com', ip_address: '198.51.100.23' },
      extra: { body: { newPassword: SECRET, nested: { apiToken: 'tok', ok: 1 } }, note: 'fine' },
      contexts: { request: { Authorization: 'Bearer x', cookieJar: 'y' }, runtime: { name: 'node' } },
      breadcrumbs: [{ category: 'http', data: { url: '/x', password: SECRET } }],
    };
    const scrubbed = sentry.scrubEvent(event);
    expect(scrubbed.request).toEqual({
      method: 'POST',
      url: 'https://assets.example.com/api/auth/login',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
    });
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toEqual({ body: { newPassword: '[redacted]', nested: { apiToken: '[redacted]', ok: 1 } }, note: 'fine' });
    expect(scrubbed.contexts).toEqual({ request: { Authorization: '[redacted]', cookieJar: '[redacted]' }, runtime: { name: 'node' } });
    expect(JSON.stringify(scrubbed)).not.toContain(SECRET);
    expect(JSON.stringify(scrubbed)).not.toContain('198.51.100.23');
  });

  it('switches off body, cookie, user and variable collection in the SDK options', () => {
    const options = sentry.buildSentryOptions({ SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0' });
    expect(options).toMatchObject({
      sendDefaultPii: false,
      dataCollection: {
        httpBodies: [], userInfo: false, cookies: false, urlQueryParams: false, stackFrameVariables: false,
      },
    });
    expect(options.beforeSend).toBe(sentry.scrubEvent);
    expect(options.beforeSendTransaction).toBe(sentry.scrubEvent);
  });
});
