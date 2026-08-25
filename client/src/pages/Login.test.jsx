import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { getGoogleButtonWidth, getGoogleLoginError, isGoogleLoginConfigured } from '../utils/googleAuth';

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <div>google-login-control</div>,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn(), loginWithToken: vi.fn() }),
}));

import Login from './Login';

describe('Google login availability', () => {
  it('keeps the Google control inside narrow mobile screens', () => {
    expect(getGoogleButtonWidth(320)).toBe(240);
    expect(getGoogleButtonWidth(1440)).toBe(368);
  });
  it('is enabled in production whenever a real client ID is configured', () => {
    expect(isGoogleLoginConfigured('client-id.apps.googleusercontent.com')).toBe(true);
  });

  it.each(['', undefined, 'your-google-client-id.apps.googleusercontent.com'])(
    'stays hidden for an absent or placeholder client ID (%s)',
    (clientId) => {
      expect(isGoogleLoginConfigured(clientId)).toBe(false);
    },
  );

  it('renders the Google sign-in control when production configuration is present', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><Login googleClientId="client-id.apps.googleusercontent.com" /></MemoryRouter>,
    );
    expect(html).toContain('google-login-control');
  });

  it('does not render the Google sign-in control without configuration', () => {
    const html = renderToStaticMarkup(<MemoryRouter><Login googleClientId="" /></MemoryRouter>);
    expect(html).not.toContain('google-login-control');
  });
});

describe('Google login errors', () => {
  it('explains an unapproved account', () => {
    expect(getGoogleLoginError(403)).toContain("hasn't been granted access");
  });

  it('explains missing server configuration', () => {
    expect(getGoogleLoginError(503)).toContain('not configured on the server');
  });

  it('provides a recoverable fallback for other failures', () => {
    expect(getGoogleLoginError(401)).toContain('use email/password');
  });
});
