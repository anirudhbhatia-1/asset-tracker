import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Ticket as TicketIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ticketsApi } from '../api/ticketsApi';
import { useTickets } from '../hooks/useTickets';
import CreateTicketModal from '../components/forms/CreateTicketModal';
import TicketDetailsModal from '../components/tickets/TicketDetailsModal';
import StatusBadge, { TicketAgeBadge } from '../components/tickets/TicketStatusBadge';
import { formatDate } from '../utils/formatters';
import { onActivateKey } from '../utils/a11y';
import PageHeader from '../components/ui/PageHeader';

const ADMIN_TYPE_LABELS = { it: 'IT', hardware: 'Hardware', hr: 'HR' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved/Closed' },
];

const Tickets = () => {
  const { user, hasPermission } = useAuth();
  const isDirector = user?.role === 'director' || user?.isDirector;
  const isHr = user?.role === 'hr';
  const isAdminOrHr = isDirector || hasPermission('tickets:resolve') || hasPermission('tickets:update');
  const canRaiseTicket = hasPermission('tickets:create');
  const { tickets, loading, error, fetchTickets, createTicket, updateTicket } = useTickets();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
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
    <div className="max-w-6xl mx-auto space-y-6">
      
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
        <div className="flex items-center gap-2 bg-base p-1.5 rounded-lg border border-border">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                filter === f.value ? 'bg-surface text-primary shadow-sm border border-border' : 'text-secondary hover:text-primary hover:bg-raised/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isAdminOrHr && (
          <div className="flex items-center gap-2 bg-base p-1.5 rounded-lg border border-border">
            <span className="px-2 text-xs font-medium uppercase tracking-wider text-secondary">View:</span>
            {[
              // No admin type means no queue is assigned; don't guess one.
              { value: 'my_queue', label: user?.adminType ? `My Queue (${ADMIN_TYPE_LABELS[user.adminType] || user.adminType})` : 'My Queue' },
              { value: 'all', label: 'All Tickets' },
              ...(isHr ? [{ value: 'my_tickets', label: 'My Raised Tickets' }] : []),
            ].map(scope => (
              <button
                key={scope.value}
                onClick={() => setQueueScope(scope.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  queueScope === scope.value
                    ? 'bg-surface text-primary shadow-sm border border-border'
                    : 'text-secondary hover:text-primary hover:bg-raised/50'
                }`}
              >
                {scope.label}
              </button>
            ))}
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

      {/* Tickets Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Scroll affordance */}
        <div className="relative">
          <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10 md:hidden" />
        <div className="overflow-x-auto pb-1">
          <table aria-label="Support tickets" className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-base border-b border-border text-secondary">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">ID</th>
                <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Title</th>
                <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Type</th>
                <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                {isAdminOrHr && queueScope !== 'my_tickets' && <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Employee</th>}
                <th scope="col" className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                // Skeleton loading rows
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-8"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-20"></div></td>
                    {isAdminOrHr && queueScope !== 'my_tickets' && <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-24"></div></td>}
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-24"></div></td>
                  </tr>
                ))
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrHr && queueScope !== 'my_tickets' ? 6 : 5} className="px-6 py-12 text-center text-secondary">
                    <p>No tickets found.</p>
                    {canRaiseTicket && (
                      <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-on-accent rounded-lg text-sm font-medium shadow-sm transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Raise Ticket
                      </button>
                    )}
                  </td>
                </tr>
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
                    <td className="px-6 py-4 capitalize text-secondary">{ticket.type}</td>
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
                    <td className="px-6 py-4 text-secondary">
                      {formatDate(ticket.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>

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
      />
    </div>
  );
};

export default Tickets;
