import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, Package, Boxes, User, Ticket, TicketPlus, UserPlus, UserMinus, LayoutDashboard,
  Settings, Plus, QrCode, CornerDownLeft, ArrowRight, Clock, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useFocusTrap from '../../hooks/useFocusTrap';
import useGlobalSearch from '../../hooks/useGlobalSearch';
import { prefetchRoute } from '../../utils/routePrefetch';
import {
  MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, addRecentItem, availableCommands, buildSections, countResults,
  defaultActiveIndex, enterTarget, flattenSections, loadRecentItems, nextActiveIndex, saveRecentItems,
  shortcutLabel, statusLabel, statusTone,
} from '../../utils/searchPalette';
import Pill from '../ui/Pill';

const KIND_ICONS = {
  asset: Package,
  stock: Boxes,
  employee: User,
  ticket: Ticket,
  onboarding: UserPlus,
  offboarding: UserMinus,
};

const COMMAND_ICONS = {
  dashboard: LayoutDashboard,
  inventory: Package,
  ticket: Ticket,
  ticketPlus: TicketPlus,
  people: User,
  onboarding: UserPlus,
  offboarding: UserMinus,
  settings: Settings,
  plus: Plus,
  scanner: QrCode,
};

// Status chip tone: the same as each record's badge elsewhere.
const pillTone = statusTone;

const iconFor = (item) => {
  if (item.type === 'result') return KIND_ICONS[item.kind] || Search;
  return COMMAND_ICONS[item.icon] || ArrowRight;
};

/**
 * Global search and quick navigation (Ctrl+K / ⌘K, "/" or the top bar's
 * search). Mounted only while open, so every opening starts empty. A modal
 * dialog with a combobox input driving a grouped listbox: arrow keys,
 * Home/End move, Enter opens, Escape closes. Full screen on phones.
 */
export default function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const dialogRef = useRef(null);
  const titleId = useId();
  const listboxId = useId();
  const statusId = useId();
  const optionPrefix = useId();

  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState(() => loadRecentItems(user?.id));
  const [activeIndex, setActiveIndex] = useState(0);

  // Traps Tab, closes on Escape, locks page scroll and returns focus to the
  // opener on close.
  useFocusTrap(dialogRef, true, onClose);

  const { results, loading, settled, error } = useGlobalSearch(query);
  const commands = useMemo(() => availableCommands(hasPermission), [hasPermission]);
  const trimmed = query.trim();

  const sections = useMemo(() => buildSections({
    query: trimmed,
    results,
    commands,
    recents,
    canSearchInventory: hasPermission('assets:read'),
  }), [trimmed, results, commands, recents, hasPermission]);
  const items = useMemo(() => flattenSections(sections), [sections]);
  const resultCount = countResults(sections);

  // A new list starts on its default option ("adjust state while rendering"):
  // the first one, except while a search is still in flight, when results on
  // screen are the previous query's — then the first command/action instead,
  // and the first result only once the answer settles.
  const signature = items.map((item) => item.id).join('|');
  const [lastSignature, setLastSignature] = useState(signature);
  const [lastSettled, setLastSettled] = useState(settled);
  if (signature !== lastSignature || settled !== lastSettled) {
    setLastSignature(signature);
    setLastSettled(settled);
    setActiveIndex(defaultActiveIndex(items, { query: trimmed, settled }));
  }

  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;
  const optionId = (index) => `${optionPrefix}-option-${index}`;

  // Keep the active option in view and warm its page.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
    // optionId only depends on optionPrefix, which never changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);
  useEffect(() => {
    if (activeItem?.href) prefetchRoute(activeItem.href);
  }, [activeItem?.href]);

  const open = (item) => {
    if (!item?.href) return;
    if (item.type === 'result') {
      const next = addRecentItem(recents, item);
      setRecents(next);
      saveRecentItems(user?.id, next);
    }
    onClose();
    navigate(item.href);
  };

  const handleKeyDown = (event) => {
    const next = nextActiveIndex(activeIndex, event.key, items.length);
    if (next !== null) {
      event.preventDefault();
      setActiveIndex(next);
      return;
    }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      // Never a stale result: while the search is in flight, Enter runs the
      // "Search assets in Inventory" action (or nothing) instead.
      open(enterTarget({
        activeItem,
        query: trimmed,
        settled,
        canSearchInventory: hasPermission('assets:read'),
      }));
    }
  };

  // What the status line (and screen readers) say about the search.
  let statusText = '';
  let statusKind = 'info';
  if (trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH) {
    statusText = `Type at least ${MIN_QUERY_LENGTH} characters to search.`;
  } else if (trimmed.length >= MIN_QUERY_LENGTH) {
    if (error) {
      statusText = error;
      statusKind = 'error';
    } else if (loading && !results) {
      statusText = 'Searching…';
    } else if (settled && resultCount === 0) {
      statusText = `No results for “${trimmed}”.`;
    } else if (settled) {
      statusText = `${resultCount} result${resultCount === 1 ? '' : 's'}.`;
    }
  }
  const showStatusLine = statusText && !(settled && resultCount > 0);
  const shortcut = shortcutLabel();

  let optionIndex = -1;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex sm:items-start sm:justify-center sm:p-6 sm:pt-[12vh]">
      <div aria-hidden="true" onClick={onClose} className="hidden sm:block fixed inset-0 bg-base/75 backdrop-blur-sm animate-fadeIn" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-command-palette=""
        className="relative z-10 flex flex-col w-full h-full sm:h-auto sm:max-h-[min(36rem,76vh)] sm:max-w-2xl bg-surface sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden animate-scaleUp pt-[env(safe-area-inset-top)]"
      >
        <h2 id={titleId} className="sr-only">Search AssetTrack</h2>

        {/* Search field */}
        <div className="flex items-center gap-2 px-3 sm:px-4 border-b border-border/80 shrink-0">
          <Search className="w-5 h-5 text-secondary shrink-0" aria-hidden="true" />
          <input
            data-autofocus
            type="text"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeItem ? optionId(activeIndex) : undefined}
            aria-describedby={statusId}
            aria-label="Search assets, people, tickets and more"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={MAX_QUERY_LENGTH}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search assets, people, tickets…"
            className="flex-1 min-w-0 h-14 bg-transparent text-base sm:text-[15px] text-primary placeholder:text-secondary focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" aria-hidden="true" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 px-2.5 py-2 sm:px-2 sm:py-1 rounded-lg text-sm sm:text-[11px] font-medium text-secondary hover:text-primary hover:bg-raised sm:border sm:border-border cursor-pointer"
          >
            <span className="sm:hidden">Cancel</span>
            <kbd className="hidden sm:inline font-sans">Esc</kbd>
          </button>
        </div>

        {/* Polite status for screen readers; visible when it adds something. */}
        <div id={statusId} role="status" aria-live="polite" className={showStatusLine ? `px-4 pt-3 text-sm flex items-center gap-2 ${statusKind === 'error' ? 'text-danger' : 'text-secondary'}` : 'sr-only'}>
          {statusKind === 'error' && <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />}
          {statusText}
        </div>

        {/* Results */}
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search results and commands"
          className="flex-1 overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {sections.map((section) => {
            const headingId = `${listboxId}-${section.key}`;
            return (
              <div key={section.key} role="group" aria-labelledby={headingId} className="py-1">
                <div id={headingId} className="flex items-center gap-1.5 px-2.5 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary">
                  {section.key === 'recent' && <Clock className="w-3 h-3" aria-hidden="true" />}
                  {section.label}
                </div>
                {section.items.map((item) => {
                  optionIndex += 1;
                  const index = optionIndex;
                  const active = index === activeIndex;
                  const Icon = iconFor(item);
                  const tone = item.status ? pillTone(item.kind, item.status) : null;
                  return (
                    <div
                      key={item.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => { if (!active) setActiveIndex(index); }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => open(item)}
                      className={`flex items-center gap-3 px-2.5 py-2.5 sm:py-2 rounded-xl cursor-pointer select-none ${active ? 'bg-accent/10 ring-1 ring-accent/25' : ''}`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${active ? 'bg-accent/15 border-accent/25 text-accent' : 'bg-raised/60 border-border/70 text-secondary'}`}>
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-medium truncate ${active ? 'text-accent' : 'text-primary'}`}>{item.label}</span>
                        {item.sublabel && <span className="block text-xs text-secondary truncate">{item.sublabel}</span>}
                      </span>
                      {tone && (
                        <span className="hidden min-[400px]:inline-flex shrink-0">
                          <Pill tone={tone}>{statusLabel(item.kind, item.status)}</Pill>
                        </span>
                      )}
                      {active && <CornerDownLeft className="hidden sm:block w-4 h-4 text-accent shrink-0" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {items.length === 0 && !showStatusLine && (
            <p className="px-3 py-8 text-center text-sm text-secondary">Nothing to show yet. Start typing to search.</p>
          )}
        </div>

        {/* Keyboard hints (not on touch-sized screens) */}
        <div className="hidden sm:flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border/80 bg-base/40 text-[11px] text-secondary shrink-0">
          <span className="flex items-center gap-3">
            <span><kbd className="font-sans px-1.5 py-0.5 rounded border border-border bg-surface">↑</kbd> <kbd className="font-sans px-1.5 py-0.5 rounded border border-border bg-surface">↓</kbd> to move</span>
            <span><kbd className="font-sans px-1.5 py-0.5 rounded border border-border bg-surface">↵</kbd> to open</span>
            <span><kbd className="font-sans px-1.5 py-0.5 rounded border border-border bg-surface">Esc</kbd> to close</span>
          </span>
          <span>Open anywhere with <kbd className="font-sans px-1.5 py-0.5 rounded border border-border bg-surface">{shortcut}</kbd></span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
