import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: { patch: vi.fn() },
}));

vi.mock('./axiosInstance', () => ({ default: api }));

import { updateAsset } from './assetsApi';

describe('assetsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses PATCH for partial asset edits', () => {
    const payload = { notes: 'Updated asset notes' };

    updateAsset(42, payload);

    expect(api.patch).toHaveBeenCalledWith('/assets/42', payload);
  });
});
