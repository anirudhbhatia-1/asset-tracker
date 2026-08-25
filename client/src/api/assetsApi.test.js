import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: { patch: vi.fn(), post: vi.fn() },
}));

vi.mock('./axiosInstance', () => ({ default: api }));

import { getImportErrorMessage, importAssetsExcel, updateAsset } from './assetsApi';

describe('assetsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses PATCH for partial asset edits', () => {
    const payload = { notes: 'Updated asset notes' };

    updateAsset(42, payload);

    expect(api.patch).toHaveBeenCalledWith('/assets/42', payload);
  });

  it('allows Excel imports enough time and lets the browser set the multipart boundary', () => {
    const file = new File(['workbook'], 'assets.xlsx');

    importAssetsExcel(file);

    expect(api.post).toHaveBeenCalledWith(
      '/assets/import',
      expect.any(FormData),
      { timeout: 120000 },
    );
  });

  it('reports timeout, network, and server import failures clearly', () => {
    expect(getImportErrorMessage({ code: 'ECONNABORTED' })).toContain('timed out');
    expect(getImportErrorMessage({ request: {} })).toContain('reach the server');
    expect(getImportErrorMessage({ response: { data: { message: 'Invalid workbook' } } }))
      .toBe('Invalid workbook');
  });
});
