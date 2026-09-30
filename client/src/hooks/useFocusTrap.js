import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open traps, innermost last, so a nested dialog owns Tab/Escape until it closes.
const trapStack = [];

/**
 * Keeps Tab focus inside `ref` while active, focuses its first control on
 * open and returns focus to the previously focused element on close. When
 * `onEscape` is given, Escape calls it (only for the innermost open trap).
 */
export default function useFocusTrap(ref, isActive, onEscape) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!isActive || !ref.current) return;

    const container = ref.current;
    const token = {};
    trapStack.push(token);
    const previouslyFocused = document.activeElement;

    // Re-query on every Tab: dialog content changes (loading states, steps).
    // Skips hidden controls (e.g. `className="hidden"` file inputs); falls back to
    // the full list where layout isn't available (jsdom).
    const getFocusable = () => {
      const all = Array.from(container.querySelectorAll(FOCUSABLE));
      const visible = all.filter((el) => el.offsetParent !== null || el === document.activeElement);
      return visible.length ? visible : all;
    };

    const handleKeyDown = (e) => {
      if (trapStack[trapStack.length - 1] !== token) return;

      if (e.key === 'Escape' && onEscapeRef.current) {
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Auto-focus the first element when active (or the container itself)
    const [firstElement] = getFocusable();
    if (firstElement) {
      firstElement.focus();
    } else {
      if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
      container.focus();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const i = trapStack.indexOf(token);
      if (i !== -1) trapStack.splice(i, 1);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isActive, ref]);
}
