import { describe, expect, it } from 'vitest';
import { getPostLoginPath } from './redirect';

describe('getPostLoginPath', () => {
  it('keeps the query string and hash of the original location', () => {
    expect(getPostLoginPath({ pathname: '/tickets', search: '?ticket=12', hash: '' })).toBe('/tickets?ticket=12');
    expect(getPostLoginPath({ pathname: '/inventory', search: '?status=available', hash: '#top' })).toBe('/inventory?status=available#top');
  });

  it('falls back to the dashboard', () => {
    expect(getPostLoginPath(undefined)).toBe('/');
    expect(getPostLoginPath({})).toBe('/');
    expect(getPostLoginPath({ pathname: '/login' })).toBe('/');
  });

  it('rejects paths that leave the app', () => {
    expect(getPostLoginPath('//evil.example.com')).toBe('/');
    expect(getPostLoginPath('https://evil.example.com')).toBe('/');
  });
});
