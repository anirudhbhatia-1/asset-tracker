import { describe, expect, it } from 'vitest';
import { withSearchParam } from './searchParams';

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
