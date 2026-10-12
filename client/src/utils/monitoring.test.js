import { describe, expect, it } from 'vitest';
import { initMonitoring, reportError, sentryOptions } from './monitoring';

describe('monitoring', () => {
  it('does nothing without a DSN', async () => {
    expect(await initMonitoring({ MODE: 'test' })).toBe(false);
    expect(() => reportError(new Error('x'))).not.toThrow();
  });

  it('builds privacy-preserving Sentry options', () => {
    expect(sentryOptions({ VITE_SENTRY_DSN: 'https://k@o.ingest.sentry.io/1', MODE: 'production', VITE_GIT_COMMIT: 'abc123' })).toEqual({
      dsn: 'https://k@o.ingest.sentry.io/1',
      environment: 'production',
      release: 'abc123',
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    expect(sentryOptions({ VITE_SENTRY_TRACES_SAMPLE_RATE: '0.2' }).tracesSampleRate).toBe(0.2);
    expect(sentryOptions({ VITE_SENTRY_TRACES_SAMPLE_RATE: 'lots' }).tracesSampleRate).toBe(0);
    expect(sentryOptions({ VITE_SENTRY_TRACES_SAMPLE_RATE: '5' }).tracesSampleRate).toBe(0);
    expect(sentryOptions({}).release).toBeUndefined();
  });
});
