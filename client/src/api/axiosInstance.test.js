import { afterEach, describe, expect, it, vi } from 'vitest';

import axiosInstance, {
  flagPasswordChangeRequired,
  isPasswordChangeRequired,
  PASSWORD_CHANGE_REQUIRED_EVENT,
  shouldRedirectForUnauthorized,
} from './axiosInstance';
import { RECENT_STORAGE_KEY } from '../utils/searchPalette';

describe('unauthorized response handling', () => {
  it('does not reload the login page for expected login failures', () => {
    expect(shouldRedirectForUnauthorized({
      response: { status: 401 },
      config: { skipAuthRedirect: true },
    })).toBe(false);
  });

  it('redirects expired authenticated sessions', () => {
    expect(shouldRedirectForUnauthorized({ response: { status: 401 }, config: {} })).toBe(true);
    expect(shouldRedirectForUnauthorized({ response: { status: 403 }, config: {} })).toBe(false);
  });
});

describe('unauthorized sign-out path', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clears the session and the palette recents, then redirects to login', async () => {
    const session = { token: 't', user: '{"id":7}' };
    const removedLocal = [];
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => session[key] ?? null,
      setItem: (key, value) => { session[key] = value; },
      removeItem: (key) => { delete session[key]; },
    });
    vi.stubGlobal('window', {
      localStorage: { removeItem: (key) => removedLocal.push(key) },
      location: { href: '/inventory' },
      dispatchEvent: () => true,
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(axiosInstance.get('/assets', {
      adapter: async (config) => Promise.reject(Object.assign(new Error('Unauthorized'), {
        config,
        response: { status: 401, data: {}, config },
      })),
    })).rejects.toThrow('Unauthorized');

    expect(session.token).toBeUndefined();
    expect(session.user).toBeUndefined();
    // Same forgetting as AuthContext's sign-out.
    expect(removedLocal).toContain(RECENT_STORAGE_KEY);
    expect(window.location.href).toBe('/login');
  });
});

describe('request serialization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const captureRequest = async (data) => {
    vi.stubGlobal('sessionStorage', { getItem: () => null });
    let captured;
    await axiosInstance.post('/test', data, {
      adapter: async (config) => {
        captured = config;
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
      },
    });
    return captured;
  };

  it('keeps FormData uploads as multipart instead of converting them to JSON', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['workbook']), 'assets.xlsx');

    const config = await captureRequest(formData);

    expect(config.data).toBeInstanceOf(FormData);
    expect(config.data.get('file')).toBeTruthy();
  });

  it('still sends plain objects as JSON', async () => {
    const config = await captureRequest({ name: 'Laptop' });

    expect(config.data).toBe('{"name":"Laptop"}');
    expect(config.headers.getContentType()).toContain('application/json');
  });
});

describe('password change required handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('recognises the server refusal', () => {
    expect(isPasswordChangeRequired({ response: { status: 403, data: { reason: 'PASSWORD_CHANGE_REQUIRED' } } })).toBe(true);
    expect(isPasswordChangeRequired({ response: { status: 403, data: { message: 'Forbidden' } } })).toBe(false);
    expect(isPasswordChangeRequired({ response: { status: 401, data: { reason: 'PASSWORD_CHANGE_REQUIRED' } } })).toBe(false);
  });

  it('flags the stored user and notifies the app once per call', () => {
    const store = { user: JSON.stringify({ id: 7, mustChangePassword: false }) };
    const dispatched = [];
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => { store[key] = value; },
    });
    vi.stubGlobal('window', { dispatchEvent: (event) => dispatched.push(event.type) });

    flagPasswordChangeRequired();

    expect(JSON.parse(store.user)).toEqual({ id: 7, mustChangePassword: true });
    expect(dispatched).toEqual([PASSWORD_CHANGE_REQUIRED_EVENT]);
  });

  it('flags the user when a response is refused, without redirecting', async () => {
    const store = { user: JSON.stringify({ id: 7 }) };
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => { store[key] = value; },
      removeItem: (key) => { delete store[key]; },
    });
    vi.stubGlobal('window', { dispatchEvent: () => true, location: { href: '/assets' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(axiosInstance.get('/assets', {
      adapter: async (config) => Promise.reject(Object.assign(new Error('Forbidden'), {
        config,
        response: { status: 403, data: { reason: 'PASSWORD_CHANGE_REQUIRED' }, config },
      })),
    })).rejects.toThrow('Forbidden');

    expect(JSON.parse(store.user).mustChangePassword).toBe(true);
    expect(window.location.href).toBe('/assets');
  });
});
