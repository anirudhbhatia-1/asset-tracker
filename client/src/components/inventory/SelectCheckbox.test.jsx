import { describe, expect, it, vi } from 'vitest';
import { stopActivationKeys } from '../../utils/assetSelection';
import { onActivateKey } from '../../utils/a11y';

const keyEvent = (key, extra = {}) => ({ key, stopPropagation: vi.fn(), ...extra });

describe('SelectCheckbox key handling', () => {
  it('stops Enter and Space so the row underneath does not open', () => {
    for (const key of ['Enter', ' ']) {
      const e = keyEvent(key);
      stopActivationKeys(e);
      expect(e.stopPropagation).toHaveBeenCalled();
    }
  });

  it('lets Ctrl+K, "/" and Escape propagate to app-wide handlers', () => {
    for (const e of [keyEvent('k', { ctrlKey: true }), keyEvent('k', { metaKey: true }), keyEvent('/'), keyEvent('Escape'), keyEvent('Tab')]) {
      stopActivationKeys(e);
      expect(e.stopPropagation).not.toHaveBeenCalled();
    }
  });

  it('row activation ignores keys from nested controls', () => {
    const handler = vi.fn();
    const row = {};
    onActivateKey(handler)({ key: 'Enter', target: {}, currentTarget: row, preventDefault: vi.fn() });
    expect(handler).not.toHaveBeenCalled();
    onActivateKey(handler)({ key: 'Enter', target: row, currentTarget: row, preventDefault: vi.fn() });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
