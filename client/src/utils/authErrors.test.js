import { describe, expect, it } from 'vitest';
import { isRetryableLoginError, loginErrorMessage } from './authErrors';

describe('loginErrorMessage', () => {
  it("passes on the server's own answer (wrong password, locked out)", () => {
    expect(loginErrorMessage({ response: { status: 401, data: { message: 'Invalid email or password' } } }))
      .toBe('Invalid email or password');
    expect(loginErrorMessage({ response: { status: 429, data: { message: 'Too many failed login attempts.' } } }))
      .toBe('Too many failed login attempts.');
  });

  it('never blames the password when the server did not answer', () => {
    expect(loginErrorMessage({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' })).toMatch(/too long/);
    expect(loginErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error' })).toMatch(/Can't reach the server/);
    const gateway = loginErrorMessage({ response: { status: 502, data: '<html>Bad Gateway</html>' } });
    expect(gateway).toMatch(/problem signing you in/);
    expect(gateway).not.toMatch(/password/i);
  });
});

describe('account lockout (423)', () => {
  const locked = {
    response: {
      status: 423,
      data: { message: 'This account is locked after too many failed sign-ins. Try again in 14 minutes, or ask an administrator to unlock it.' },
    },
  };

  it("shows the server's lockout message as-is", () => {
    expect(loginErrorMessage(locked)).toBe(locked.response.data.message);
  });

  it('still explains the lockout when the server sent no message', () => {
    expect(loginErrorMessage({ response: { status: 423, data: {} } })).toMatch(/locked after too many failed sign-ins/);
  });

  it('is never retried', () => {
    expect(isRetryableLoginError(locked)).toBe(false);
  });
});

describe('isRetryableLoginError', () => {
  it('retries only when there was no real answer', () => {
    expect(isRetryableLoginError({ code: 'ERR_NETWORK' })).toBe(true);
    expect(isRetryableLoginError({ response: { status: 503 } })).toBe(true);
    expect(isRetryableLoginError({ response: { status: 401 } })).toBe(false);
    expect(isRetryableLoginError({ response: { status: 429 } })).toBe(false);
    expect(isRetryableLoginError({ response: { status: 500 } })).toBe(false);
    // A timeout may still be running on the server: retrying could count a
    // wrong password twice toward the lockout.
    expect(isRetryableLoginError({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' })).toBe(false);
    expect(isRetryableLoginError({ response: { status: 504 } })).toBe(false);
  });
});
