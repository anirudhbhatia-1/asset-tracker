import { afterEach, describe, expect, it, vi } from 'vitest';

import axiosInstance, { shouldRedirectForUnauthorized } from './axiosInstance';

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
