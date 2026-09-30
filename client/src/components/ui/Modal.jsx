import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg', // 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl'
}) {
  const modalRef = useRef(null);
  const titleId = useId();
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(modalRef, isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;

    // Lock body scroll while modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop with blur per Design 4 */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-base/75 backdrop-blur-sm transition-opacity duration-200 animate-fadeIn"
      />

      {/* Modal Dialog Content */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${maxWidth} bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 animate-scaleUp z-10`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-surface/90">
          <h3 id={titleId} className="text-base font-semibold text-primary">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-raised/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-9rem)]">{children}</div>
      </div>
    </div>,
    document.body
  );
}
