import { describe, expect, it } from 'vitest';
import { resolveDeepLink, withSearchParam } from './searchParams';

describe('withSearchParam', () => {
  it('sets the key and keeps the other params', () => {
    const next = withSearchParam(new URLSearchParams('status=available&category=3'), 'q', ' dell ');
    expect(next.toString()).toBe('status=available&category=3&q=dell');
  });

  it('replaces an existing value', () => {
    expect(withSearchParam(new URLSearchParams('q=old&status=in-use'), 'q', 'new').toString()).toBe('q=new&status=in-use');
  });

  it('removes the key for a blank value', () => {
    expect(withSearchParam(new URLSearchParams('q=old&status=in-use'), 'q', '   ').toString()).toBe('status=in-use');
  });

  it('does not mutate the input', () => {
    const params = new URLSearchParams('q=old');
    withSearchParam(params, 'q', 'new');
    expect(params.get('q')).toBe('old');
  });
});

describe('resolveDeepLink', () => {
  const list = [{ id: 3, name: 'Asha' }, { id: 12, name: 'Vik' }];

  it('waits while the list is loading or refreshing', () => {
    expect(resolveDeepLink({ id: '3', list: [], loading: true }).status).toBe('wait');
    expect(resolveDeepLink({ id: '3', list, refreshing: true }).status).toBe('wait');
    // Even a failed load concludes nothing until the refresh settles.
    expect(resolveDeepLink({ id: '99', list: [], refreshing: true, error: 'down' }).status).toBe('wait');
  });

  it('opens the matching record (ids compared as strings)', () => {
    expect(resolveDeepLink({ id: '12', list })).toEqual({ status: 'open', match: list[1] });
    expect(resolveDeepLink({ id: 12, list })).toEqual({ status: 'open', match: list[1] });
  });

  it('is "not found" only when the list settled cleanly', () => {
    expect(resolveDeepLink({ id: '99', list })).toEqual({ status: 'not-found', match: null });
    expect(resolveDeepLink({ id: '99', list: undefined })).toEqual({ status: 'not-found', match: null });
  });

  it('never claims "not found" when the list failed to load', () => {
    expect(resolveDeepLink({ id: '99', list: [], error: 'Network down' }).status).toBe('error');
    // A match cached from before the failure still opens.
    expect(resolveDeepLink({ id: '3', list, error: 'Network down' }).status).toBe('open');
  });

  it('matches on a custom id field', () => {
    const rows = [{ key: 'a' }, { key: 'b' }];
    expect(resolveDeepLink({ id: 'b', list: rows, idOf: (row) => row.key }).match).toBe(rows[1]);
  });
});
