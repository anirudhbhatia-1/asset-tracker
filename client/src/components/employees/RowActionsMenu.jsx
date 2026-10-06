import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

const MENU_WIDTH = 224; // px, matches w-56
const GAP = 4;

/**
 * "More actions" (⋯) button with an accessible dropdown menu.
 *
 *   <RowActionsMenu
 *     label="More actions for Priya Sharma"
 *     items={[{ key: 'reset', label: 'Reset password', ariaLabel: '…', icon: KeyRound, onSelect, tone: 'danger' }]}
 *   />
 *
 * The menu is rendered in a portal with fixed positioning so a table's
 * overflow can't clip it; it opens upward when there is no room below.
 * Arrow keys / Home / End move between items, Escape or Tab closes it, a
 * click outside closes it. Choosing an item puts focus back on the button
 * (without scrolling) before running the item, so a dialog it opens returns
 * focus there too.
 */
export default function RowActionsMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);
  const focusOnOpen = useRef(0);
  const menuId = useId();

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const openMenu = (focusIndex = 0) => {
    focusOnOpen.current = focusIndex;
    setOpen(true);
  };

  // Place the menu next to the button, flipping up near the bottom of the screen.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || items.length * 40 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + GAP && rect.top > spaceBelow;
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    setPosition({
      left,
      top: openUp ? Math.max(8, rect.top - menuHeight - GAP) : rect.bottom + GAP,
    });
  }, [open, items.length]);

  // Focus the requested item once the menu is placed.
  useEffect(() => {
    if (!open || !position) return;
    const index = focusOnOpen.current < 0 ? items.length - 1 : focusOnOpen.current;
    itemRefs.current[index]?.focus({ preventScroll: true });
  }, [open, position, items.length]);

  // Outside click, scroll and resize close the menu.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close(false);
    };
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      openMenu(0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      openMenu(-1);
    }
  };

  const handleMenuKeyDown = (e) => {
    e.stopPropagation();
    const count = items.length;
    const current = itemRefs.current.indexOf(document.activeElement);
    const focusAt = (i) => itemRefs.current[(i + count) % count]?.focus({ preventScroll: true });
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(current + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(current - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(count - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') { close(true); }
  };

  const handleSelect = (item) => {
    close(true);
    item.onSelect();
  };

  if (!items.length) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close(false);
          else openMenu(0);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-base text-secondary hover:text-primary hover:bg-surface transition-colors shadow-sm cursor-pointer ${
          open ? 'text-primary bg-surface ring-2 ring-accent/30' : ''
        }`}
      >
        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: position?.top ?? -9999,
            left: position?.left ?? -9999,
            width: MENU_WIDTH,
            visibility: position ? 'visible' : 'hidden',
          }}
          className="z-50 py-1 bg-surface border border-border rounded-xl shadow-xl text-left"
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                ref={(el) => { itemRefs.current[index] = el; }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-label={item.ariaLabel}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left cursor-pointer transition-colors focus:outline-none focus:bg-raised hover:bg-raised ${
                  item.tone === 'danger' ? 'text-danger' : 'text-primary'
                }`}
              >
                {Icon && (
                  <Icon
                    className={`w-4 h-4 shrink-0 ${item.tone === 'danger' ? '' : item.iconClassName || 'text-accent'}`}
                    aria-hidden="true"
                  />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
