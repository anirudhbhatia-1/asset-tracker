// Shared stale-while-revalidate cache for list data (assets, employees,
// tickets...). Pages start from what was loaded last time and refresh it in
// the background, so revisiting a page renders at once instead of showing a
// skeleton. Concurrent loads of the same key share one request.
//
// Each entry is replaced (never mutated) on change, so it can be read with
// React's useSyncExternalStore (see hooks/useQuery.js).

const EMPTY = Object.freeze({ data: undefined, error: null, fetching: false, updatedAt: 0 });

const entries = new Map();
const listeners = new Map();
// Bumped by clearQueryCache(): answers to requests started before it (e.g.
// for the previous user) are dropped instead of stored.
let generation = 0;

// Keys marked by invalidate() that still have a mounted reader; they are
// reloaded together on the next tick, so several invalidations in a row
// (a hook's own plus the global one after the same request) send one request.
const pendingRefetch = new Set();
let flushPromise = null;

const notify = (key) => {
  const set = listeners.get(key);
  if (set) set.forEach((fn) => fn());
};

// At most this many lists are kept; the least recently stored ones that no
// page is showing are dropped first (every search term is its own entry).
const MAX_ENTRIES = 50;

const evictOld = () => {
  if (entries.size <= MAX_ENTRIES) return;
  for (const key of entries.keys()) {
    if (entries.size <= MAX_ENTRIES) break;
    const entry = entries.get(key);
    if (!hasListeners(key) && !entry.promise) entries.delete(key);
  }
};

const write = (key, patch) => {
  const next = { ...(entries.get(key) || EMPTY), ...patch };
  // Re-insert so Map order is "least recently stored first".
  entries.delete(key);
  entries.set(key, next);
  notify(key);
  evictOld();
  return next;
};

const isEmptyParam = (value) => value === undefined || value === null || value === '';

/**
 * Stable key for a request: the base path plus its params, sorted, with
 * empty values left out — so { scope: undefined } and {} share one entry.
 */
export const queryKey = (base, params = {}) => {
  const parts = Object.keys(params || {})
    .filter((name) => !isEmptyParam(params[name]))
    .sort()
    .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(String(params[name]))}`);
  return parts.length ? `${base}?${parts.join('&')}` : base;
};

/** The whole entry ({ data, error, fetching, updatedAt }); a shared empty one when unknown. */
export const getQueryEntry = (key) => (key == null ? EMPTY : entries.get(key) || EMPTY);

/** Cached data for the key, or undefined. */
export const getQueryData = (key) => getQueryEntry(key).data;

export const subscribeQuery = (key, fn) => {
  if (key == null) return () => {};
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0 && listeners.get(key) === set) listeners.delete(key);
  };
};

const hasListeners = (key) => (listeners.get(key)?.size || 0) > 0;

/**
 * Loads the key with `fetcher` and stores the result. A load already in
 * flight for the key is shared unless `force` is set (used after a change,
 * when an older request may have read the data before it). The promise
 * resolves with the freshest data for the key: if a newer load replaced
 * this one, it waits for that one instead.
 */
export const fetchQuery = (key, fetcher, { force = false } = {}) => {
  const current = entries.get(key);
  if (current?.promise && !force) return current.promise;

  const startedIn = generation;
  let request;
  try {
    request = Promise.resolve(fetcher());
  } catch (err) {
    request = Promise.reject(err);
  }

  const superseded = () => startedIn !== generation || entries.get(key)?.promise !== promise;
  // A replaced load hands over to the load that replaced it.
  const handOver = (fallback) => {
    const latest = startedIn === generation ? entries.get(key) : null;
    if (latest?.promise && latest.promise !== promise) return latest.promise;
    return fallback();
  };

  const promise = request.then(
    (data) => {
      if (superseded()) {
        // Resolve with the newer copy already stored, if there is one.
        return handOver(() => {
          const latest = startedIn === generation ? entries.get(key) : null;
          return latest?.data !== undefined ? latest.data : data;
        });
      }
      write(key, { data, error: null, fetching: false, promise: null, updatedAt: Date.now() });
      return data;
    },
    (err) => {
      if (superseded()) return handOver(() => { throw err; });
      write(key, { error: err, fetching: false, promise: null });
      throw err;
    },
  );

  write(key, { fetcher, promise, fetching: true, error: null });
  return promise;
};

/**
 * Replaces the cached data with updater(previous) — e.g. to merge a row the
 * server returned after a save. Does nothing when nothing is cached yet.
 */
export const setQueryData = (key, updater) => {
  const entry = entries.get(key);
  if (!entry || entry.data === undefined) return undefined;
  const data = typeof updater === 'function' ? updater(entry.data) : updater;
  write(key, { data, updatedAt: Date.now() });
  return data;
};

const matches = (key, target) => {
  if (target === undefined) return true;
  if (typeof target === 'function') return target(key);
  return key === target || key.startsWith(target);
};

const flush = () => {
  const keys = [...pendingRefetch];
  pendingRefetch.clear();
  flushPromise = null;
  return Promise.allSettled(keys.map((key) => {
    const entry = entries.get(key);
    if (!entry?.fetcher) return null;
    // invalidate() detached older loads, so one in flight now started after
    // the change (e.g. the page's own refresh) and is fresh enough.
    if (entry.promise) return entry.promise;
    return fetchQuery(key, entry.fetcher, { force: true });
  }));
};

/**
 * Marks matching keys out of date (`target`: a key prefix such as 'assets',
 * a predicate, or nothing for every key). Keys nobody is showing are dropped
 * at once, so the next visit loads fresh data rather than showing old rows;
 * keys on screen keep their rows and reload quietly on the next tick.
 * Resolves once those reloads have settled.
 */
export const invalidateQueries = (target) => {
  [...entries.keys()].forEach((key) => {
    if (!matches(key, target)) return;
    const entry = entries.get(key);
    if (hasListeners(key) && entry.fetcher) {
      // Detach any load already in flight: it may predate the change.
      entries.set(key, { ...entry, promise: null });
      pendingRefetch.add(key);
    } else {
      entries.delete(key);
    }
  });
  if (pendingRefetch.size === 0) return flushPromise || Promise.resolve();
  if (!flushPromise) {
    flushPromise = new Promise((resolve) => {
      setTimeout(() => flush().then(() => resolve()), 0);
    });
  }
  return flushPromise;
};

/** Changes whenever the cache is cleared; readers drop anything older. */
export const getCacheGeneration = () => generation;

/**
 * Forgets everything (sign-out, or another user / other permissions).
 * With `reloadMounted`, lists still on screen are loaded again straight away
 * (for the new user), so a page never waits on an empty entry; at sign-out
 * nothing is reloaded.
 */
export const clearQueryCache = ({ reloadMounted = false } = {}) => {
  generation += 1;
  const reload = reloadMounted
    ? [...entries].filter(([key, entry]) => hasListeners(key) && entry.fetcher).map(([key, entry]) => [key, entry.fetcher])
    : [];
  entries.clear();
  pendingRefetch.clear();
  // Mounted readers re-read the (now empty) entries.
  [...listeners.keys()].forEach(notify);
  reload.forEach(([key, fetcher]) => { fetchQuery(key, fetcher).catch(() => {}); });
};

// Which cached lists a successful change (POST/PUT/PATCH/DELETE) can affect,
// by the first segment of its URL. Most changes ripple widely (assigning an
// asset changes the asset list, the employee's holdings, offboarding
// checklists...), so anything not listed reloads every list except the
// slow-changing categories and locations.
const NO_CACHED_EFFECT = new Set(['auth', 'notifications']);
const RESOURCE_EFFECTS = {
  categories: ['categories', 'assets', 'stock'],
  locations: ['locations', 'assets', 'employees', 'stock', 'onboarding'],
};
const SHARED_LOOKUPS = ['categories', 'locations'];

export const resourceOfUrl = (url = '') => {
  const path = String(url).replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
  const segments = path.split('/').filter(Boolean);
  // Skip an API prefix such as /api.
  if (segments[0] === 'api') segments.shift();
  return segments[0] || '';
};

/** Invalidates what a successful change request may have made out of date. */
export const invalidateAfterMutation = (method, url) => {
  const verb = String(method || 'get').toLowerCase();
  if (verb === 'get' || verb === 'head' || verb === 'options') return Promise.resolve();
  const resource = resourceOfUrl(url);
  if (NO_CACHED_EFFECT.has(resource)) return Promise.resolve();
  const affected = RESOURCE_EFFECTS[resource];
  if (affected) {
    return invalidateQueries((key) => affected.some((prefix) => key === prefix || key.startsWith(prefix)));
  }
  return invalidateQueries((key) => !SHARED_LOOKUPS.some((prefix) => key.startsWith(prefix)));
};
