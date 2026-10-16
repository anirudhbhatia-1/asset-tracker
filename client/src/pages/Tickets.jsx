import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Ticket as TicketIcon, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ticketsApi } from '../api/ticketsApi';
import { useTickets } from '../hooks/useTickets';
import CreateTicketModal from '../components/forms/CreateTicketModal';
import TicketDetailsModal from '../components/tickets/TicketDetailsModal';
import ReopenTicketModal from '../components/tickets/ReopenTicketModal';
import StatusBadge, { PriorityBadge, TicketAgeBadge, TicketTypeBadge } from '../components/tickets/TicketStatusBadge';
import { formatDate } from '../utils/formatters';
import { onActivateKey } from '../utils/a11y';
import PageHeader from '../components/ui/PageHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import SearchBar from '../components/inventory/SearchBar';
import { QUEUE_SHORT_LABELS, queueLabel, ticketRef } from '../utils/ticketMeta';
import { PRIORITY_FILTERS, SORTS, STATUS_FILTERS, filterTickets, readTicketQuery, sortTickets } from '../utils/ticketQueue';

// The first load (My Queue / own tickets); a revisit renders its cached rows at once.
const INITIAL_FILTERS = { scope: undefined };
// Lower-priority columns, shown from xl so the table fits beside the sidebar.
const FROM_XL = 'hidden xl:table-cell';
const TH = 'px-5 py-3.5 font-medium uppercase tracking-wider text-xs';
const TD = 'px-5 py-3.5';

const Tickets = () => {
  const { user, hasPermission } = useAuth();
  const isDirector = user?.role === 'director' || user?.isDirector;
  const isHr = user?.role === 'hr';
  // The server only lists other people's tickets for tickets:resolve holders
  // and Directors; everyone else sees just their own.
  const isAdminOrHr = isDirector || hasPermission('tickets:resolve');
  // Directors always get every ticket, so the queue toggle is for resolvers.
  const showQueueToggle = isAdminOrHr && !isDirector;
  const canRaiseTicket = hasPermission('tickets:create');
  const {
    tickets, loading, isPlaceholder, error, fetchTickets, createTicket, updateTicket,
    transferTicket, confirmCloseTicket, reopenTicket,
  } = useTickets(INITIAL_FILTERS);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [reopeningTicket, setReopeningTicket] = useState(null);

  // Filters live in the URL: /tickets?status=active&priority=urgent_high&view=all&q=vpn&sort=priority
  const [searchParams, setSearchParams] = useSearchParams();
  const query = readTicketQuery(searchParams, { worksTickets: isAdminOrHr });
  const queueScope = showQueueToggle || query.view === 'my_tickets' ? query.view : 'my_queue';
  const setQuery = useCallback((changes) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const handleSearch = useCallback((q) => setQuery({ q }), [setQuery]);

  // Which scope the current `tickets` list belongs to, so the deep-link
  // lookup below never searches a stale or still-loading list.
  const [loadedScope, setLoadedScope] = useState(null);

  // Deep link from notifications: /tickets?ticket=<id>
  const deepLinkId = searchParams.get('ticket');
  const handledDeepLinkRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let scope;
    if (queueScope === 'all') scope = 'all';
    else if (queueScope === 'my_tickets') scope = 'my_tickets';
    else scope = undefined; // default: my_queue
    setLoadedScope(null);
    fetchTickets({ scope }).then(() => {
      if (!cancelled) setLoadedScope(queueScope);
    });
    return () => { cancelled = true; };
  }, [fetchTickets, queueScope]);

  const clearDeepLink = useCallback(() => {
    setSearchParams(prev => {
      if (!prev.has('ticket')) return prev;
      const next = new URLSearchParams(prev);
      next.delete('ticket');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (!deepLinkId) {
      handledDeepLinkRef.current = null;
      return;
    }
    if (handledDeepLinkRef.current === deepLinkId || loadedScope !== queueScope) return;

    const match = tickets.find(t => String(t.id) === deepLinkId);
    if (match) {
      handledDeepLinkRef.current = deepLinkId;
      setSelectedTicket(match);
      return;
    }
    // Not in the current view (e.g. another queue): fetch just that ticket.
    // Ignore the answer if the user has moved on to a different link meanwhile.
    handledDeepLinkRef.current = deepLinkId;
    ticketsApi.getById(deepLinkId)
      .then((ticket) => {
        if (ticket && handledDeepLinkRef.current === deepLinkId) setSelectedTicket(ticket);
      })
      .catch(() => {
        if (handledDeepLinkRef.current !== deepLinkId) return;
        toast.error(`Ticket ${ticketRef({ id: deepLinkId })} was not found or is no longer visible to you.`);
        clearDeepLink();
      });
  }, [deepLinkId, tickets, loadedScope, queueScope, clearDeepLink]);

  // /tickets?new=1 (e.g. "Raise ticket" in global search) opens the form.
  const wantsNewTicket = searchParams.get('new') === '1';
  useEffect(() => {
    if (!wantsNewTicket) return;
    if (canRaiseTicket) setIsCreateModalOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('new');
      return next;
    }, { replace: true });
  }, [wantsNewTicket, canRaiseTicket, setSearchParams]);

  const closeTicketDetails = useCallback(() => {
    setSelectedTicket(null);
    clearDeepLink();
  }, [clearDeepLink]);

  const visibleTickets = sortTickets(filterTickets(tickets, query), query.sort);
  const isFiltered = query.status !== 'all' || query.priority !== 'all' || Boolean(query.q) || Boolean(query.queue);
  const showEmployee = isAdminOrHr && queueScope !== 'my_tickets';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={TicketIcon}
        title="Support Tickets"
        subtitle={isAdminOrHr && queueScope !== 'my_tickets' ? 'Manage employee requests and issues.' : 'Track your support requests.'}
        actions={canRaiseTicket && (
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Raise Ticket
          </Button>
        )}
      />

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label="Ticket status" value={query.status} onChange={(status) => setQuery({ status })} options={STATUS_FILTERS} />

          {showQueueToggle && (
            <SegmentedControl
              label="Ticket queue"
              value={queueScope}
              onChange={(view) => setQuery({ view })}
              options={[
                // No admin type means no queue is assigned; don't guess one.
                { value: 'my_queue', label: user?.adminType ? `My Queue (${QUEUE_SHORT_LABELS[user.adminType] || user.adminType})` : 'My Queue' },
                { value: 'all', label: 'All Tickets' },
                ...(isHr ? [{ value: 'my_tickets', label: 'Raised by Me' }] : []),
              ]}
            />
          )}
          {query.queue && (
            <button
              type="button"
              onClick={() => setQuery({ queue: undefined })}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/15 cursor-pointer"
              aria-label={`Remove filter: ${queueLabel(query.queue)} tickets only`}
            >
              {queueLabel(query.queue)} only <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <SearchBar
            initialValue={query.q}
            onSearch={handleSearch}
            label="Search tickets"
            placeholder={showEmployee ? 'Search by title, person, device or TK number…' : 'Search by title, device or TK number…'}
          />
          <Select aria-label="Priority" value={query.priority} onChange={(e) => setQuery({ priority: e.target.value })} className="sm:w-44">
            {PRIORITY_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <Select aria-label="Sort tickets" value={query.sort} onChange={(e) => setQuery({ sort: e.target.value })} className="sm:w-44">
            {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-error/10 border border-error/20 text-error rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Tickets (the empty state sits outside the table so it isn't
          clipped by the sideways-scrolling area). Skeleton rows only on the
          first load; switching views or reloading keeps the rows. */}
      {!loading && visibleTickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title="No Tickets Found"
          description={isFiltered
            ? 'No tickets match these filters.'
            : (canRaiseTicket ? 'Nothing here yet. Raise a ticket to report a problem or request something.' : 'There are no tickets in this view.')}
          actionText={isFiltered ? 'Clear Filters' : (canRaiseTicket ? 'Raise Ticket' : undefined)}
          onAction={isFiltered
            ? () => setQuery({ status: 'all', priority: undefined, q: undefined, queue: undefined })
            : (canRaiseTicket ? () => setIsCreateModalOpen(true) : undefined)}
        />
      ) : (
      <>
      <p className="sr-only" aria-live="polite">{loading ? '' : `${visibleTickets.length} ticket${visibleTickets.length === 1 ? '' : 's'}`}</p>
      {/* Phones: one card per ticket */}
      <ul aria-label="Support tickets" aria-busy={loading || undefined} className="md:hidden space-y-3">
        {loading ? [1, 2, 3].map((i) => (
          <li key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse space-y-2">
            <div className="h-4 bg-raised rounded w-48" />
            <div className="h-3 bg-raised rounded w-32" />
          </li>
        )) : visibleTickets.map((ticket) => (
          <li
            key={ticket.id}
            onClick={() => setSelectedTicket(ticket)}
            role="button"
            aria-label={`Open ticket ${ticketRef(ticket)}: ${ticket.title}`}
            tabIndex={0}
            onKeyDown={onActivateKey(() => setSelectedTicket(ticket))}
            className="bg-surface border border-border rounded-xl shadow-sm p-4 space-y-2 cursor-pointer hover:border-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-primary truncate">{ticket.title}</div>
                <div className="text-xs text-secondary truncate mt-0.5">{ticket.description || 'No description'}</div>
              </div>
              <span className="font-mono text-xs text-secondary shrink-0">{ticketRef(ticket)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <TicketAgeBadge ticket={ticket} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
              <TicketTypeBadge type={ticket.type} />
              {showEmployee && <span>{ticket.employee_name || `Employee #${ticket.employee_id}`}</span>}
              <span>{formatDate(ticket.created_at)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className={`overflow-x-auto pb-1 transition-opacity ${isPlaceholder ? 'opacity-60' : ''}`}>
          <table aria-label="Support tickets" aria-busy={loading || isPlaceholder || undefined} className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-base border-b border-border text-secondary">
              <tr>
                <th scope="col" className={TH}>Ticket</th>
                <th scope="col" className={TH}>Title</th>
                <th scope="col" className={TH}>Priority</th>
                <th scope="col" className={TH}>Status</th>
                {showEmployee && <th scope="col" className={TH}>Raised by</th>}
                <th scope="col" className={`${FROM_XL} ${TH}`}>Type</th>
                <th scope="col" className={`${FROM_XL} ${TH}`}>Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className={TD}><div className="h-4 bg-raised rounded w-14" /></td>
                    <td className={TD}><div className="h-4 bg-raised rounded w-48" /></td>
                    <td className={TD}><div className="h-4 bg-raised rounded w-14" /></td>
                    <td className={TD}><div className="h-4 bg-raised rounded w-20" /></td>
                    {showEmployee && <td className={TD}><div className="h-4 bg-raised rounded w-24" /></td>}
                    <td className={`${FROM_XL} ${TD}`}><div className="h-4 bg-raised rounded w-16" /></td>
                    <td className={`${FROM_XL} ${TD}`}><div className="h-4 bg-raised rounded w-24" /></td>
                  </tr>
                ))
              ) : (
                visibleTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    role="button"
                    aria-label={`Open ticket ${ticketRef(ticket)}: ${ticket.title}`}
                    tabIndex={0}
                    onKeyDown={onActivateKey(() => setSelectedTicket(ticket))}
                    className="hover:bg-raised/30 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:bg-raised/40"
                  >
                    <td className={`${TD} font-mono text-xs text-secondary group-hover:text-accent`}>{ticketRef(ticket)}</td>
                    <td className={TD}>
                      <div className="font-medium text-primary max-w-xs truncate">{ticket.title}</div>
                      <div className="text-xs text-secondary truncate max-w-xs mt-0.5">{ticket.description || 'No description'}</div>
                    </td>
                    <td className={TD}><PriorityBadge priority={ticket.priority} /></td>
                    <td className={TD}>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={ticket.status} />
                        <TicketAgeBadge ticket={ticket} />
                      </div>
                    </td>
                    {showEmployee && (
                      <td className={`${TD} text-secondary`}>{ticket.employee_name || `Employee #${ticket.employee_id}`}</td>
                    )}
                    <td className={`${FROM_XL} ${TD}`}><TicketTypeBadge type={ticket.type} /></td>
                    <td className={`${FROM_XL} ${TD} text-secondary`}>{formatDate(ticket.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      <CreateTicketModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createTicket}
      />

      <TicketDetailsModal
        isOpen={!!selectedTicket}
        ticket={selectedTicket}
        onClose={closeTicketDetails}
        onUpdate={updateTicket}
        onTransfer={transferTicket}
        onConfirmClose={confirmCloseTicket}
        onReopen={(ticket) => {
          closeTicketDetails();
          setReopeningTicket(ticket);
        }}
      />

      <ReopenTicketModal ticket={reopeningTicket} onClose={() => setReopeningTicket(null)} onReopen={reopenTicket} />
    </div>
  );
};

export default Tickets;
