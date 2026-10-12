import React, { useEffect, useRef } from 'react';
import { stopActivationKeys } from '../../utils/assetSelection';

const stop = (e) => e.stopPropagation();

/**
 * Selection checkbox for asset rows and cards. Its clicks and Enter/Space
 * never reach the row/card underneath (which would open the asset). Supports the
 * indeterminate state for "some selected" header checkboxes.
 */
export default function SelectCheckbox({ checked, indeterminate = false, onChange, label, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);

  return (
    // The label is the (44px on phones) hit area around the small box.
    <label
      onClick={stop}
      onKeyDown={stopActivationKeys}
      className={`inline-flex items-center justify-center min-w-11 min-h-11 md:min-w-8 md:min-h-8 rounded-lg cursor-pointer hover:bg-raised/60 ${className}`}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        aria-checked={indeterminate && !checked ? 'mixed' : checked}
        className="w-4 h-4 rounded border-border accent-accent cursor-pointer"
      />
    </label>
  );
}
