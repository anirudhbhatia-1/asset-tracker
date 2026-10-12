import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import useAttention from '../../hooks/useAttention';
import { Skeleton } from '../ui/Skeleton';
import { prefetchRoute } from '../../utils/routePrefetch';
import { attentionSummary } from '../../utils/attention';

const COLLAPSED_KEY = 'attentionPanelCollapsed';

const SEVERITY = {
  high: { icon: AlertOctagon, label: 'Urgent', bar: 'bg-danger', iconBox: 'bg-danger/10 text-danger border-danger/20', badge: 'bg-danger/10 text-danger border-danger/25' },
  medium: { icon: AlertTriangle, label: 'Soon', bar: 'bg-warning', iconBox: 'bg-warning/10 text-warning border-warning/20', badge: 'bg-warning/10 text-warning border-warning/25' },
  low: { icon: Info, label: 'FYI', bar: 'bg-info-blue', iconBox: 'bg-info-blue/10 text-info-blue border-info-blue/20', badge: 'bg-info-blue/10 text-info-blue border-info-blue/25' },
};

const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
};
const writeCollapsed = (value) => {
  try { localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0'); } catch { /* storage unavailable */ }
};

const warm = (link) => () => prefetchRoute(link);

function AttentionItem({ item }) {
  const style = SEVERITY[item.severity] || SEVERITY.low;
  const Icon = style.icon;
  const titleId = useId();
  return (
    <li className="relative bg-surface border border-border/80 rounded-xl overflow-hidden flex flex-col">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
      <div className="flex items-center gap-3 pl-4 pr-3 pt-3 pb-2">
        <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${style.iconBox}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
          <span className="sr-only">{style.label}:</span>
        </span>
        <h3 id={titleId} className="flex-1 min-w-0 text-sm font-semibold text-primary leading-snug">{item.title}</h3>
        <span className={`shrink-0 min-w-7 text-center px-2 py-0.5 rounded-full text-xs font-bold border ${style.badge}`}>
          {item.count}
        </span>
      </div>

      {item.entries.length > 0 && (
        <ul aria-labelledby={titleId} className="px-2 pb-1 space-y-0.5">
          {item.entries.map((entry, i) => {
            const body = (
              <>
                <span className="block text-sm text-primary truncate">{entry.label}</span>
                {entry.sublabel && <span className="block text-xs text-secondary truncate">{entry.sublabel}</span>}
              </>
            );
            return (
              <li key={`${entry.label}-${i}`}>
                {entry.link ? (
                  <Link
                    to={entry.link}
                    onMouseEnter={warm(entry.link)}
                    onFocus={warm(entry.link)}
                    className="block px-2 py-1.5 rounded-lg hover:bg-raised/60 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="px-2 py-1.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {item.link && (
        <Link
          to={item.link}
          onMouseEnter={warm(item.link)}
          onFocus={warm(item.link)}
          className="mt-auto flex items-center justify-end gap-1 px-3 py-2 border-t border-border/60 text-xs font-semibold text-accent hover:bg-accent/5"
        >
          View all<span className="sr-only"> {item.title.toLowerCase()}</span>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}

/**
 * "Needs attention" for the dashboards: what the user should act on, from
 * GET /dashboard/attention (already limited to what they may see). Takes
 * little room when nothing is due; collapsible (remembered per browser).
 */
export default function AttentionPanel({ className = '' }) {
  const { items, loading, error, refresh } = useAttention();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const headingId = useId();
  const bodyId = useId();

  const toggle = () => {
    setCollapsed((prev) => {
      writeCollapsed(!prev);
      return !prev;
    });
  };

  if (loading) {
    return (
      <section aria-label="Needs attention" aria-busy="true" className={`space-y-3 ${className}`}>
        <Skeleton className="h-5 w-40 bg-raised rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className={`h-32 bg-raised/70 rounded-xl ${i > 0 ? 'hidden md:block' : ''} ${i > 1 ? 'md:hidden xl:block' : ''}`} />)}
        </div>
      </section>
    );
  }

  if (error && items.length === 0) {
    return (
      <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface px-4 py-2.5 text-sm text-secondary ${className}`}>
        <span className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" aria-hidden="true" />
          <span className="truncate">{error}</span>
        </span>
        <button type="button" onClick={refresh} className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-accent hover:underline cursor-pointer min-h-11 sm:min-h-0">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div role="status" className={`flex items-center gap-2 rounded-xl border border-success/25 bg-success/5 px-4 py-2.5 text-sm text-primary ${className}`}>
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
        <span>You’re all caught up. Nothing needs your attention right now.</span>
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId} className={`space-y-3 ${className}`}>
      <h2 id={headingId} className="text-sm font-semibold">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="inline-flex items-center gap-2 min-h-11 sm:min-h-0 -ml-1 px-1 rounded-lg text-primary hover:text-accent cursor-pointer"
        >
          <ChevronDown className={`w-4 h-4 text-secondary transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
          <span className="uppercase tracking-wider">Needs attention</span>
          {/* Keeps the accessible name from running the words together ("Needs attention2 items"). */}
          <span className="sr-only">: </span>
          <span className="font-normal normal-case tracking-normal text-secondary">{attentionSummary(items)}</span>
        </button>
      </h2>
      <ul id={bodyId} hidden={collapsed} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((item) => <AttentionItem key={item.key} item={item} />)}
      </ul>
    </section>
  );
}
