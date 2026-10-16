import React, { cloneElement, isValidElement } from 'react';

// Shared form controls, so every input, select and textarea has the same
// height, radius, focus ring and error state.
import { controlClass } from './fieldStyles';

export function Input({ invalid, className = '', ...props }) {
  return <input {...props} aria-invalid={invalid || props['aria-invalid'] || undefined} className={`${controlClass(invalid)} ${className}`} />;
}

export function Select({ invalid, className = '', children, ...props }) {
  return (
    <select {...props} aria-invalid={invalid || props['aria-invalid'] || undefined} className={`${controlClass(invalid)} cursor-pointer ${className}`}>
      {children}
    </select>
  );
}

export function Textarea({ invalid, className = '', ...props }) {
  return <textarea {...props} aria-invalid={invalid || props['aria-invalid'] || undefined} className={`${controlClass(invalid)} resize-none ${className}`} />;
}

const OWN_CONTROLS = new Set([Input, Select, Textarea]);

/**
 * Label + control + hint/error, wired for screen readers:
 *   <Field id="title" label="Title" required error={err} hint="Short summary">
 *     <Input value={title} onChange={…} />
 *   </Field>
 * The control gets `id`, `aria-describedby` and the invalid state from here.
 */
export default function Field({ id, label, required = false, hint, error, className = '', labelAction, children }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
      id: children.props.id || id,
      'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
      // Our controls take `invalid`; a plain element gets aria-invalid.
      ...(error ? (OWN_CONTROLS.has(children.type) ? { invalid: true } : { 'aria-invalid': true }) : {}),
      ...(required ? { required: true } : {}),
    })
    : children;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="block text-sm font-medium text-primary">
            {label}
            {required && <span className="text-error" aria-hidden="true"> *</span>}
          </label>
          {labelAction}
        </div>
      )}
      {control}
      {hint && !error && <p id={hintId} className="text-xs text-secondary">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-error">{error}</p>}
    </div>
  );
}
