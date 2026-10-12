import { useEffect, useRef } from 'react';
import { isPaletteShortcut, isTextEntryTarget } from '../utils/searchPalette';

// Another dialog (not the palette) is open: "/" must not pop search over it.
const otherDialogOpen = () => Boolean(document.querySelector('[aria-modal="true"]:not([data-command-palette])'));

/**
 * Global shortcuts for the command palette: Ctrl+K / ⌘K anywhere (also
 * while typing in a field) toggles it; "/" opens it when focus isn't in a
 * text field and no other dialog is open.
 */
export default function usePaletteShortcut({ isOpen, onOpen, onClose }) {
  const stateRef = useRef({ isOpen, onOpen, onClose });
  useEffect(() => {
    stateRef.current = { isOpen, onOpen, onClose };
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented && !isPaletteShortcut(event)) return;
      const { isOpen: open, onOpen: openPalette, onClose: closePalette } = stateRef.current;
      if (isPaletteShortcut(event)) {
        event.preventDefault();
        if (open) closePalette();
        else openPalette();
        return;
      }
      if (
        event.key === '/' && !open && !event.ctrlKey && !event.metaKey && !event.altKey
        && !event.isComposing && !isTextEntryTarget(event.target) && !otherDialogOpen()
      ) {
        event.preventDefault();
        openPalette();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
