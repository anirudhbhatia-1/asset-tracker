import { describe, expect, it } from 'vitest';

import { shouldRedirectForUnauthorized } from './axiosInstance';

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
