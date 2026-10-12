import React, { useId, useState } from 'react';
import { ArrowRight, ChevronDown, History, RefreshCw, Search, X } from 'lucide-react';
import useAuditLog from '../../hooks/useAuditLog';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { AUDIT_EVENT_GROUPS, auditChangeRows, auditGroupOf, describeAuditEvent } from '../../utils/auditText';
import { formatDateTime } from '../../utils/formatters';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';

const GROUP_STYLES = {
  roles: { label: 'Roles', className: 'text-info-purple bg-info-purple/10 border-info-purple/20' },
  access: { label: 'Login access', className: 'text-info-blue bg-info-blue/10 border-info-blue/20' },
  passwords: { label: 'Password', className: 'text-warning bg-warning/10 border-warning/20' },
  data: { label: 'Data', className: 'text-success bg-success/10 border-success/20' },
  other: { label: 'Other', className: 'text-secondary bg-base border-border' },
};

const inputClass = 'w-full min-w-0 bg-base border border-border rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all';

function GroupPill({ eventType }) {
  const style = GROUP_STYLES[auditGroupOf(eventType)] || GROUP_STYLES.other;
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${style.className}`}>
      {style.label}
    </span>
  );
}

// Old → new values for one event; nothing when the event carries none.
function ChangeDetails({ event, id }) {
  const rows = auditChangeRows(event);
  return (
    <div id={id} className="mt-3 rounded-xl border border-border bg-base/60 p-3 text-xs">
      {rows.length === 0 ? (
        <p className="text-secondary">No further details were recorded for this event.</p>
      ) : (
        <dl className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-1 sm:gap-3">
              <dt className="font-semibold text-secondary">{row.label}</dt>
              <dd className="text-primary flex flex-wrap items-center gap-1.5 break-all">
                {row.from !== null && (
                  <>
                    <span className="line-through decoration-danger/60 text-secondary">{row.from}</span>
                    <ArrowRight className="w-3 h-3 text-secondary shrink-0" aria-label="changed to" />
                  </>
                )}
                <span>{row.to ?? '—'}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-[11px] text-secondary">Event type: <code>{event.eventType}</code></p>
    </div>
  );
}

function DetailsToggle({ expanded, onToggle, controls, sentence }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      aria-label={`${expanded ? 'Hide' : 'Show'} details: ${sentence}`}
      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline px-2 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
    >
      Details
      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
  );
}

export default function AuditLogTab() {
  const fieldId = useId();
  const [group, setGroup] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, 350);
  const [expanded, setExpanded] = useState(() => new Set());

  const dateRangeInvalid = Boolean(from && to && from > to);
  const { events, loading, refreshing, loadingMore, hasMore, error, refresh, loadMore } = useAuditLog({
    group, from, to, q, enabled: !dateRangeInvalid,
  });

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const filtered = group !== 'all' || from || to || search.trim();
  const resetFilters = () => {
    setGroup('all');
    setFrom('');
    setTo('');
    setSearch('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Access history</h2>
          <p className="text-sm text-secondary">
            Who changed roles, sign-in access and passwords, account lockouts, and data exports and imports. Newest first.
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh access history"
          title="Refresh"
          onClick={refresh}
          className="self-start p-2.5 rounded-xl bg-surface hover:bg-raised text-secondary border border-border transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin text-accent' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-2xl border border-border/80 p-4 shadow-sm grid grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-3">
        <div className="space-y-1 col-span-2 lg:col-span-1">
          <label htmlFor={`${fieldId}-q`} className="text-xs font-semibold text-secondary">Search people</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true" />
            <input
              id={`${fieldId}-q`}
              type="search"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name of who did it or who it affected"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
        <div className="space-y-1 col-span-2 lg:col-span-1">
          <label htmlFor={`${fieldId}-group`} className="text-xs font-semibold text-secondary">Event type</label>
          <select
            id={`${fieldId}-group`}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            {AUDIT_EVENT_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-from`} className="text-xs font-semibold text-secondary">From</label>
          <input
            id={`${fieldId}-from`}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-to`} className="text-xs font-semibold text-secondary">To</label>
          <input
            id={`${fieldId}-to`}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </div>
        {filtered && (
          <div className="col-span-2 lg:col-span-4 flex items-center justify-between gap-2">
            {dateRangeInvalid ? (
              <p role="alert" className="text-xs text-danger">The “From” date is after the “To” date.</p>
            ) : <span />}
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:text-primary px-2 py-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" /> Clear filters
            </button>
          </div>
        )}
      </div>

      {error && events.length > 0 && (
        <p role="status" className="text-xs text-warning">
          Couldn&apos;t refresh the history ({error}). Showing the last loaded copy.
        </p>
      )}

      {error && events.length === 0 ? (
        <div role="alert" className="p-8 bg-danger/10 border border-danger/30 rounded-2xl text-center space-y-3">
          <p className="text-sm text-danger font-medium">{error}</p>
          <Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>
        </div>
      ) : !loading && events.length === 0 ? (
        <EmptyState
          icon={History}
          title="No history found"
          description={filtered ? 'Nothing matches these filters.' : 'Changes to roles, access and passwords will appear here.'}
          actionText={filtered ? 'Clear filters' : undefined}
          onAction={filtered ? resetFilters : undefined}
        />
      ) : (
        <>
          {/* Phones: one card per event. */}
          <ul aria-label="Access history" aria-busy={loading || undefined} className="md:hidden space-y-3">
            {loading ? [1, 2, 3].map((i) => (
              <li key={i} className="bg-surface rounded-2xl border border-border p-4 animate-pulse space-y-2">
                <div className="h-3 bg-raised rounded w-28" />
                <div className="h-4 bg-raised rounded w-56" />
              </li>
            )) : events.map((event) => {
              const sentence = describeAuditEvent(event);
              const isOpen = expanded.has(event.id);
              const detailsId = `${fieldId}-m-${event.id}`;
              return (
                <li key={event.id} className="bg-surface rounded-2xl border border-border shadow-sm p-4">
                  <div className="flex items-center justify-between gap-2">
                    <time dateTime={event.createdAt} className="text-xs text-secondary">{formatDateTime(event.createdAt)}</time>
                    <GroupPill eventType={event.eventType} />
                  </div>
                  <p className="mt-1.5 text-sm text-primary">{sentence}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-secondary truncate">By {event.actorName || (event.actorId ? 'Unknown user' : 'System')}</span>
                    <DetailsToggle expanded={isOpen} onToggle={() => toggle(event.id)} controls={detailsId} sentence={sentence} />
                  </div>
                  {isOpen && <ChangeDetails event={event} id={detailsId} />}
                </li>
              );
            })}
          </ul>

          <div className="hidden md:block bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
            <table aria-label="Access history" aria-busy={loading || undefined} className="w-full text-left text-sm">
              <thead className="bg-base/60 border-b border-border text-xs text-secondary uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold w-48">When</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold w-44">Who</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">What happened</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold text-right w-28"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-3"><div className="h-4 bg-raised rounded w-32" /></td>
                    <td className="px-5 py-3"><div className="h-4 bg-raised rounded w-24" /></td>
                    <td className="px-5 py-3"><div className="h-4 bg-raised rounded w-72" /></td>
                    <td className="px-5 py-3"><div className="h-4 bg-raised rounded w-14 ml-auto" /></td>
                  </tr>
                )) : events.map((event) => {
                  const sentence = describeAuditEvent(event);
                  const isOpen = expanded.has(event.id);
                  const detailsId = `${fieldId}-t-${event.id}`;
                  return (
                    <tr key={event.id} className={`align-top ${isOpen ? 'bg-raised/30' : 'hover:bg-raised/30'} transition-colors`}>
                        <td className="px-5 py-3 text-secondary whitespace-nowrap">
                          <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                        </td>
                        <td className="px-5 py-3 text-primary font-medium">
                          {event.actorName || <span className="text-secondary font-normal">{event.actorId ? 'Unknown user' : 'System'}</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-primary">{sentence}</span>
                            <GroupPill eventType={event.eventType} />
                          </div>
                          {isOpen && <ChangeDetails event={event} id={detailsId} />}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <DetailsToggle expanded={isOpen} onToggle={() => toggle(event.id)} controls={detailsId} sentence={sentence} />
                        </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && (
            <div className="flex flex-col items-center gap-2 pt-2">
              {hasMore ? (
                <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                  Load more
                </Button>
              ) : (
                <p className="text-xs text-secondary">
                  {events.length === 1 ? 'Showing the only event.' : `Showing all ${events.length.toLocaleString('en-IN')} events.`}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
