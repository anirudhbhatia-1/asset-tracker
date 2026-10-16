import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

// How long the close animation plays before the dialog leaves the DOM.
const EXIT_MS = 150;

const prefersReducedMotion = () => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg', // 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl'
  // Optional actions bar pinned under the scrolling body (Save/Cancel…).
  footer,
  // Extra content beside the title (status pills…).
  headerExtra,
}) {
  const modalRef = useRef(null);
  const titleId = useId();
  // Traps Tab inside the dialog, closes it on Escape and locks body scroll
  // (released as soon as closing starts, while the exit animation plays).
  useFocusTrap(modalRef, isOpen, onClose);

  // Stay mounted briefly after `isOpen` turns false so the dialog can fade
  // out. Reopening during the fade simply cancels it.
  const [isRendered, setIsRendered] = useState(isOpen);
  if (isOpen && !isRendered) setIsRendered(true);
  useEffect(() => {
    if (isOpen || !isRendered) return undefined;
    const timer = setTimeout(() => setIsRendered(false), prefersReducedMotion() ? 0 : EXIT_MS);
    return () => clearTimeout(timer);
  }, [isOpen, isRendered]);

  // Keep showing the last open content during the fade, in case the parent
  // clears the data the body was built from as it closes.
  const lastContent = useRef({ title, children, footer, headerExtra });
  if (isOpen) lastContent.current = { title, children, footer, headerExtra };

  if (!isRendered) return null;
  const isClosing = !isOpen;
  const shown = isClosing ? lastContent.current : { title, children, footer, headerExtra };

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto ${isClosing ? 'pointer-events-none' : ''}`}
      aria-hidden={isClosing || undefined}
      inert={isClosing || undefined}
    >
      {/* Backdrop with blur per Design 4 */}
      <div
        onClick={isClosing ? undefined : onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-base/75 backdrop-blur-sm ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
      />

      {/* Modal Dialog Content */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${maxWidth} bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden ${isClosing ? 'animate-scaleDown' : 'animate-scaleUp'} z-10`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border/80 bg-surface/90">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-primary">
              {shown.title}
            </h2>
            {shown.headerExtra}
          </div>
          <button
            type="button"
            onClick={isClosing ? undefined : onClose}
            className="p-2.5 sm:p-1.5 -mr-1.5 rounded-lg text-secondary hover:text-primary hover:bg-raised/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className={`p-6 overflow-y-auto ${shown.footer ? 'max-h-[calc(90dvh-13rem)]' : 'max-h-[calc(90dvh-9rem)]'}`}>{shown.children}</div>
        {shown.footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-border bg-base/50">
            {shown.footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
