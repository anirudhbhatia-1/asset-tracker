import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Form fields that make sense to type into straight away.
const FORM_FIELD =
  'form input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([readonly]), form select:not([disabled]), form textarea:not([disabled]):not([readonly])';

// Open traps, innermost last, so a nested dialog owns Tab/Escape until it closes.
const trapStack = [];

// Body scroll lock shared by every open dialog. Reference-counted so closing
// a nested dialog doesn't unlock the page under the outer one.
let scrollLockCount = 0;
let savedBodyOverflow = '';

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
  }
}

// On touch screens, focusing a text field pops the keyboard over the dialog,
// so there we start on the first control (usually Close) instead.
function prefersFieldFocus() {
  try {
    return !window.matchMedia?.('(pointer: coarse)').matches;
  } catch {
    return true;
  }
}

/**
 * Keeps Tab focus inside `ref` while active and returns focus to the
 * previously focused element on close. On open it focuses, in order: an
 * element marked `data-autofocus`, the first field of a form in the dialog
 * (not on touch screens), or the first control. While active the page
 * behind is scroll-locked. When `onEscape` is given, Escape calls it (only
 * for the innermost open trap).
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
    lockBodyScroll();
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

    // Auto-focus the best starting element (or the container itself)
    const isShown = (el) => el.offsetParent !== null;
    const preferred =
      container.querySelector('[data-autofocus]') ||
      (prefersFieldFocus() ? Array.from(container.querySelectorAll(FORM_FIELD)).find(isShown) : null);
    const [firstElement] = getFocusable();
    if (preferred) {
      preferred.focus();
    } else if (firstElement) {
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
      unlockBodyScroll();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        // preventScroll: don't jump sideways-scrolled tables back to the opener.
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isActive, ref]);
}
