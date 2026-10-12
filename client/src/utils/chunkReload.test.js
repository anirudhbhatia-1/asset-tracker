import { describe, expect, it, vi } from 'vitest';
import { CHUNK_RELOAD_KEY, isChunkLoadError, reloadOnceForNewBuild } from './chunkReload';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
};

describe('isChunkLoadError', () => {
  it('recognises failed lazy page loads in each browser', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError({ name: 'ChunkLoadError', message: 'Loading chunk 7 failed.' })).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('reloadOnceForNewBuild', () => {
  it('reloads once, then not again within a minute', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(reloadOnceForNewBuild({ storage, reload, now: 1_000_000 })).toBe(true);
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBe('1000000');
    expect(reloadOnceForNewBuild({ storage, reload, now: 1_030_000 })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    // A later deploy in the same tab may reload again.
    expect(reloadOnceForNewBuild({ storage, reload, now: 1_100_000 })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('never reloads without working storage (no loop guard)', () => {
    const reload = vi.fn();
    expect(reloadOnceForNewBuild({ storage: null, reload })).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => {} };
    expect(reloadOnceForNewBuild({ storage: broken, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
