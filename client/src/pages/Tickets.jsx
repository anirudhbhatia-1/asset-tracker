import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Ticket as TicketIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ticketsApi } from '../api/ticketsApi';
import { useTickets } from '../hooks/useTickets';
import CreateTicketModal from '../components/forms/CreateTicketModal';
import TicketDetailsModal from '../components/tickets/TicketDetailsModal';
import ReopenTicketModal from '../components/tickets/ReopenTicketModal';
import StatusBadge, { TicketAgeBadge } from '../components/tickets/TicketStatusBadge';
import { formatDate } from '../utils/formatters';
import { onActivateKey } from '../utils/a11y';
import PageHeader from '../components/ui/PageHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import EmptyState from '../components/ui/EmptyState';

const ADMIN_TYPE_LABELS = { it: 'IT', hardware: 'Hardware', hr: 'HR' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved/Closed' },
];

// The first load (My Queue / own tickets); a revisit renders its cached rows at once.
const INITIAL_FILTERS = { scope: undefined };
// Lower-priority columns, shown from xl so the table fits beside the sidebar.
const FROM_XL = 'hidden xl:table-cell';

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
  const [filter, setFilter] = useState('all');
  const [queueScope, setQueueScope] = useState('my_queue'); // 'my_queue' | 'all' | 'my_tickets'
  // Which scope the current `tickets` list belongs to, so the deep-link
  // lookup below never searches a stale or still-loading list.
  const [loadedScope, setLoadedScope] = useState(null);

  // Deep link from notifications: /tickets?ticket=<id>
  const [searchParams, setSearchParams] = useSearchParams();
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
    handledDeepLinkRef.current = deepLinkId;
    ticketsApi.getById(deepLinkId)
      .then((ticket) => setSelectedTicket(ticket))
      .catch(() => {
        toast.error(`Ticket #${deepLinkId} was not found or is no longer visible to you.`);
        clearDeepLink();
      });
  }, [deepLinkId, tickets, loadedScope, queueScope, clearDeepLink]);

  const closeTicketDetails = useCallback(() => {
    setSelectedTicket(null);
    clearDeepLink();
  }, [clearDeepLink]);

  const filteredTickets = tickets.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'active') return t.status === 'open' || t.status === 'in_progress';
    if (filter === 'resolved') return t.status === 'resolved' || t.status === 'closed' || t.status === 'rejected';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header Area */}
      <PageHeader
        icon={TicketIcon}
        title="Support Tickets"
        subtitle={isAdminOrHr && queueScope !== 'my_tickets' ? 'Manage employee requests and issues.' : 'Track your IT support requests.'}
        actions={canRaiseTicket && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-on-accent rounded-lg font-medium shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Raise Ticket
          </button>
        )}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl label="Ticket status" value={filter} onChange={setFilter} options={FILTERS} />

        {showQueueToggle && (
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            <span className="text-xs font-medium uppercase tracking-wider text-secondary shrink-0" aria-hidden="true">View:</span>
            <SegmentedControl
              label="Ticket queue"
              value={queueScope}
              onChange={setQueueScope}
              options={[
                // No admin type means no queue is assigned; don't guess one.
                { value: 'my_queue', label: user?.adminType ? `My Queue (${ADMIN_TYPE_LABELS[user.adminType] || user.adminType})` : 'My Queue' },
                { value: 'all', label: 'All Tickets' },
                ...(isHr ? [{ value: 'my_tickets', label: 'My Raised Tickets' }] : []),
              ]}
            />
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Tickets (the empty state sits outside the table so it isn't
          clipped by the sideways-scrolling area). Skeleton rows only on the
          first load; switching views or reloading keeps the rows. */}
      {!loading && filteredTickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title="No tickets found"
          description={filter === 'all'
            ? (canRaiseTicket ? 'Nothing here yet. Raise a ticket to report an issue or request hardware.' : 'There are no tickets in this view.')
            : 'No tickets match this filter.'}
          actionText={canRaiseTicket ? 'Raise Ticket' : undefined}
          onAction={canRaiseTicket ? () => setIsCreateModalOpen(true) : undefined}
        />
      ) : (
      <>
      {/* Phones: one card per ticket */}
      <ul aria-label="Support tickets" aria-busy={loading || undefined} className="md:hidden space-y-3">
        {loading ? [1, 2, 3].map((i) => (
          <li key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse space-y-2">
            <div className="h-4 bg-raised rounded w-48" />
            <div className="h-3 bg-raised rounded w-32" />
          </li>
        )) : filteredTickets.map((ticket) => (
          <li
            key={ticket.id}
            onClick={() => setSelectedTicket(ticket)}
            tabIndex={0}
            onKeyDown={onActivateKey(() => setSelectedTicket(ticket))}
            className="bg-surface border border-border rounded-xl shadow-sm p-4 space-y-2 cursor-pointer hover:border-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-primary truncate">{ticket.title}</div>
                <div className="text-xs text-secondary truncate mt-0.5">{ticket.description || 'No description'}</div>
              </div>
              <span className="font-mono text-xs text-secondary shrink-0">#{ticket.id}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={ticket.status} />
              <TicketAgeBadge ticket={ticket} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
              <span className="capitalize">{ticket.type}</span>
              {isAdminOrHr && queueScope !== 'my_tickets' && (
                <span>{ticket.employee_name || `Employee #${ticket.employee_id}`}</span>
              )}
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
                <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">ID</th>
                <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Title</th>
                <th scope="col" className={`${FROM_XL} px-6 py-4 font-medium uppercase tracking-wider text-xs`}>Type</th>
                <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                {isAdminOrHr && queueScope !== 'my_tickets' && <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Employee</th>}
                <th scope="col" className={`${FROM_XL} px-6 py-4 font-medium uppercase tracking-wider text-xs`}>Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                // Skeleton loading rows
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-8"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-48"></div></td>
                    <td className={`${FROM_XL} px-6 py-4`}><div className="h-4 bg-raised rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-20"></div></td>
                    {isAdminOrHr && queueScope !== 'my_tickets' && <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-24"></div></td>}
                    <td className={`${FROM_XL} px-6 py-4`}><div className="h-4 bg-raised rounded w-24"></div></td>
                  </tr>
                ))
              ) : (
                filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    tabIndex={0}
                    onKeyDown={onActivateKey(() => setSelectedTicket(ticket))}
                    className="hover:bg-raised/30 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-secondary group-hover:text-accent">
                      #{ticket.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-primary max-w-xs truncate">{ticket.title}</div>
                      <div className="text-xs text-secondary truncate max-w-xs mt-0.5">{ticket.description || 'No description'}</div>
                    </td>
                    <td className={`${FROM_XL} px-6 py-4 capitalize text-secondary`}>{ticket.type}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={ticket.status} />
                        <TicketAgeBadge ticket={ticket} />
                      </div>
                    </td>
                    {isAdminOrHr && queueScope !== 'my_tickets' && (
                      <td className="px-6 py-4 text-secondary">
                        {ticket.employee_name || `Employee #${ticket.employee_id}`}
                      </td>
                    )}
                    <td className={`${FROM_XL} px-6 py-4 text-secondary`}>
                      {formatDate(ticket.created_at)}
                    </td>
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
