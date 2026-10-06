import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  queryKey, getQueryData, getQueryEntry, fetchQuery, setQueryData, subscribeQuery,
  invalidateQueries, clearQueryCache, invalidateAfterMutation, resourceOfUrl,
} from './queryCache';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

afterEach(() => clearQueryCache());

describe('queryKey', () => {
  it('sorts params and drops empty ones', () => {
    expect(queryKey('assets', { status: 'available', q: 'mac' })).toBe('assets?q=mac&status=available');
    expect(queryKey('tickets', { scope: undefined })).toBe('tickets');
    expect(queryKey('tickets', { scope: '' , x: null })).toBe('tickets');
  });
});

describe('fetchQuery', () => {
  it('stores the result and serves it from the cache', async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2]);
    await expect(fetchQuery('assets', fetcher)).resolves.toEqual([1, 2]);
    expect(getQueryData('assets')).toEqual([1, 2]);
    expect(getQueryEntry('assets').fetching).toBe(false);
  });

  it('shares one request between concurrent callers', async () => {
    const fetcher = vi.fn().mockResolvedValue(['a']);
    const [a, b] = await Promise.all([fetchQuery('employees', fetcher), fetchQuery('employees', fetcher)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('keeps the previous data while a refresh is in flight', async () => {
    await fetchQuery('assets', () => Promise.resolve(['old']));
    const next = deferred();
    const refresh = fetchQuery('assets', () => next.promise, { force: true });
    expect(getQueryData('assets')).toEqual(['old']);
    expect(getQueryEntry('assets').fetching).toBe(true);
    next.resolve(['new']);
    await refresh;
    expect(getQueryData('assets')).toEqual(['new']);
  });

  it('never lets an older response overwrite a newer one', async () => {
    const slow = deferred();
    const fast = deferred();
    const first = fetchQuery('tickets', () => slow.promise);
    const second = fetchQuery('tickets', () => fast.promise, { force: true });
    fast.resolve(['newer']);
    await second;
    slow.resolve(['older']);
    // The superseded call hands over to the newer result.
    await expect(first).resolves.toEqual(['newer']);
    expect(getQueryData('tickets')).toEqual(['newer']);
  });

  it('records a failure without dropping cached data', async () => {
    await fetchQuery('stock', () => Promise.resolve(['kept']));
    const err = new Error('boom');
    await expect(fetchQuery('stock', () => Promise.reject(err), { force: true })).rejects.toBe(err);
    expect(getQueryData('stock')).toEqual(['kept']);
    expect(getQueryEntry('stock').error).toBe(err);
  });
});

describe('setQueryData', () => {
  it('updates cached data and notifies readers', async () => {
    await fetchQuery('employees', () => Promise.resolve([{ id: 1, workMode: 'office' }]));
    const listener = vi.fn();
    const unsubscribe = subscribeQuery('employees', listener);
    setQueryData('employees', (prev) => prev.map((e) => ({ ...e, workMode: 'remote' })));
    expect(getQueryData('employees')).toEqual([{ id: 1, workMode: 'remote' }]);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('does nothing when nothing is cached', () => {
    expect(setQueryData('missing', () => ['x'])).toBeUndefined();
    expect(getQueryData('missing')).toBeUndefined();
  });
});

describe('invalidateQueries', () => {
  it('drops entries nobody is showing', async () => {
    await fetchQuery('assets?status=available', () => Promise.resolve(['a']));
    await fetchQuery('categories', () => Promise.resolve(['c']));
    await invalidateQueries('assets');
    expect(getQueryData('assets?status=available')).toBeUndefined();
    expect(getQueryData('categories')).toEqual(['c']);
  });

  it('reloads entries on screen once, keeping their rows meanwhile', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(['v1'])
      .mockResolvedValueOnce(['v2']);
    await fetchQuery('tickets', fetcher);
    const unsubscribe = subscribeQuery('tickets', () => {});
    const done = Promise.all([invalidateQueries('tickets'), invalidateQueries()]);
    expect(getQueryData('tickets')).toEqual(['v1']);
    await done;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(getQueryData('tickets')).toEqual(['v2']);
    unsubscribe();
  });

  it('ignores a response that started before the change', async () => {
    await fetchQuery('employees', () => Promise.resolve(['before']));
    const unsubscribe = subscribeQuery('employees', () => {});
    const stale = deferred();
    const fetcher = vi.fn()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(['after']);
    fetchQuery('employees', fetcher, { force: true });
    const reload = invalidateQueries('employees');
    stale.resolve(['stale']);
    await reload;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(getQueryData('employees')).toEqual(['after']);
    unsubscribe();
  });
});

describe('clearQueryCache', () => {
  it('forgets everything and drops answers to earlier requests', async () => {
    await fetchQuery('employees', () => Promise.resolve(['user A']));
    const pending = deferred();
    const inFlight = fetchQuery('tickets', () => pending.promise);
    clearQueryCache();
    expect(getQueryData('employees')).toBeUndefined();
    pending.resolve(['user A tickets']);
    await inFlight;
    expect(getQueryData('tickets')).toBeUndefined();
  });

  it('reloads lists still on screen when asked (same user, changed access)', async () => {
    let calls = 0;
    const fetcher = () => Promise.resolve([`load ${++calls}`]);
    await fetchQuery('employees', fetcher);
    await fetchQuery('assets?q=old', () => Promise.resolve(['not on screen']));
    const unsubscribe = subscribeQuery('employees', () => {});
    clearQueryCache({ reloadMounted: true });
    // The page on screen is loading again at once, not left empty.
    expect(getQueryEntry('employees').fetching).toBe(true);
    await getQueryEntry('employees').promise;
    expect(getQueryData('employees')).toEqual(['load 2']);
    expect(getQueryData('assets?q=old')).toBeUndefined();
    unsubscribe();
  });

  it('does not reload anything at sign-out', async () => {
    const fetcher = vi.fn(() => Promise.resolve([1]));
    await fetchQuery('employees', fetcher);
    const unsubscribe = subscribeQuery('employees', () => {});
    clearQueryCache();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getQueryEntry('employees').fetching).toBe(false);
    unsubscribe();
  });

  it('tells mounted readers to re-read', async () => {
    await fetchQuery('assets', () => Promise.resolve([1]));
    const listener = vi.fn();
    const unsubscribe = subscribeQuery('assets', listener);
    clearQueryCache();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});

describe('invalidateAfterMutation', () => {
  it('finds the resource of a request URL', () => {
    expect(resourceOfUrl('/employees/3/role')).toBe('employees');
    expect(resourceOfUrl('/api/assets/1/assign?x=1')).toBe('assets');
    expect(resourceOfUrl('http://localhost:3001/api/tickets')).toBe('tickets');
  });

  it('ignores reads and auth/notification calls', async () => {
    await fetchQuery('assets', () => Promise.resolve([1]));
    await invalidateAfterMutation('get', '/assets');
    await invalidateAfterMutation('post', '/auth/logout');
    await invalidateAfterMutation('patch', '/notifications/read');
    expect(getQueryData('assets')).toEqual([1]);
  });

  it('keeps shared lookups for ordinary changes', async () => {
    await fetchQuery('assets', () => Promise.resolve([1]));
    await fetchQuery('categories', () => Promise.resolve([2]));
    await fetchQuery('locations', () => Promise.resolve([3]));
    await invalidateAfterMutation('post', '/assets/1/assign');
    expect(getQueryData('assets')).toBeUndefined();
    expect(getQueryData('categories')).toEqual([2]);
    expect(getQueryData('locations')).toEqual([3]);
  });

  it('reloads categories and the lists showing them after a category change', async () => {
    await fetchQuery('categories', () => Promise.resolve([2]));
    await fetchQuery('assets', () => Promise.resolve([1]));
    await fetchQuery('tickets', () => Promise.resolve([4]));
    await invalidateAfterMutation('put', '/categories/2');
    expect(getQueryData('categories')).toBeUndefined();
    expect(getQueryData('assets')).toBeUndefined();
    expect(getQueryData('tickets')).toEqual([4]);
  });
});

describe('size cap', () => {
  it('drops the oldest lists nobody is showing once there are too many', async () => {
    const unsubscribe = subscribeQuery('assets?q=0', () => {});
    for (let i = 0; i < 60; i += 1) {
      await fetchQuery(`assets?q=${i}`, () => Promise.resolve([i]));
    }
    // The list on screen is kept even though it is the oldest.
    expect(getQueryData('assets?q=0')).toEqual([0]);
    expect(getQueryData('assets?q=1')).toBeUndefined();
    expect(getQueryData('assets?q=59')).toEqual([59]);
    unsubscribe();
  });
});
