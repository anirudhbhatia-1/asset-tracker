import React, { useState, useEffect } from 'react';
import { Plus, Ticket as TicketIcon, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTickets } from '../hooks/useTickets';
import CreateTicketModal from '../components/forms/CreateTicketModal';
import TicketDetailsModal from '../components/tickets/TicketDetailsModal';

const StatusBadge = ({ status }) => {
  const styles = {
    open: 'bg-error/10 text-error border-error/20',
    in_progress: 'bg-warning/10 text-warning border-warning/20',
    resolved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-raised text-secondary border-border'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const Tickets = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'hr';
  const { tickets, loading, error, fetchTickets, createTicket, updateTicket } = useTickets();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filter, setFilter] = useState('all');
  const [queueScope, setQueueScope] = useState('my_queue'); // 'my_queue' or 'all'

  useEffect(() => {
    fetchTickets({ scope: queueScope === 'all' ? 'all' : undefined });
  }, [fetchTickets, queueScope]);

  const filteredTickets = tickets.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'active') return t.status === 'open' || t.status === 'in_progress';
    if (filter === 'resolved') return t.status === 'resolved' || t.status === 'rejected';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <TicketIcon className="w-6 h-6 text-accent" />
            Support Tickets
          </h1>
          <p className="text-secondary text-sm mt-1">
            {isAdmin ? 'Manage employee requests and issues.' : 'Track your IT support requests.'}
          </p>
        </div>
        
        {!isAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Raise Ticket
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 bg-base p-1.5 rounded-lg border border-border w-max">
        {['all', 'active', 'resolved'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-surface text-primary shadow-sm border border-border' : 'text-secondary hover:text-primary hover:bg-raised/50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 bg-base p-1.5 rounded-lg border border-border w-max">
          <span className="px-2 text-xs font-medium uppercase tracking-wider text-secondary">Queue:</span>
          {['my_queue', 'all'].map(scope => (
            <button
              key={scope}
              onClick={() => setQueueScope(scope)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                queueScope === scope ? 'bg-surface text-primary shadow-sm border border-border' : 'text-secondary hover:text-primary hover:bg-raised/50'
              }`}
            >
              {scope === 'my_queue' ? `My Queue (${user.adminType === 'it' ? 'IT' : user.adminType === 'hardware' ? 'Hardware' : 'HR'})` : 'All Tickets'}
            </button>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error/20 text-error rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Tickets Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-base border-b border-border text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">ID</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Title</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Type</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                {isAdmin && <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Employee</th>}
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Date</th>
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
                    {isAdmin && <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-24"></div></td>}
                    <td className="px-6 py-4"><div className="h-4 bg-raised rounded w-24"></div></td>
                  </tr>
                ))
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-secondary">
                    No tickets found.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => setSelectedTicket(ticket)}
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
                    <td className="px-6 py-4"><StatusBadge status={ticket.status} /></td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-secondary">Employee #{ticket.employee_id}</td>
                    )}
                    <td className="px-6 py-4 text-secondary">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
        onClose={() => setSelectedTicket(null)} 
        onUpdate={updateTicket} 
      />
    </div>
  );
};

export default Tickets;
