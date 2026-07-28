import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getEmployeeAssets } from '../api/employeesApi';
import { useTickets } from '../hooks/useTickets';
import Badge from '../components/ui/Badge';
import StatusPill from '../components/ui/StatusPill';
import { Laptop, Ticket as TicketIcon, Calendar, Plus, PackageX } from 'lucide-react';
import { Link } from 'react-router-dom';
import CreateTicketModal from '../components/forms/CreateTicketModal';
import TicketDetailsModal from '../components/tickets/TicketDetailsModal';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  
  const { tickets, loading: ticketsLoading, fetchTickets, createTicket, updateTicket } = useTickets();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    if (user?.id) {
      getEmployeeAssets(user.id)
        .then(res => setAssets(res.data?.data || []))
        .catch(err => console.error("Failed to fetch assets", err))
        .finally(() => setAssetsLoading(false));
    } else {
      setAssetsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const recentTickets = tickets.slice(0, 5); // show most recent 5 on dashboard
  const safeAssets = Array.isArray(assets) ? assets : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Welcome, {user?.name || 'Employee'}</h1>
        <p className="text-sm text-secondary mt-1">
          View your assigned hardware and manage support requests.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Assets */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-base/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
              <Laptop className="w-4 h-4 text-accent" />
              My Assigned Assets
            </h2>
          </div>
          <div className="p-4 flex-1">
            {assetsLoading ? (
               <div className="animate-pulse space-y-3">
                 {[1,2].map(i => <div key={i} className="h-16 bg-base rounded-xl border border-border" />)}
               </div>
            ) : safeAssets.length === 0 ? (
               <div className="py-10 bg-base/40 rounded-xl border border-border/40 text-center space-y-2">
                 <PackageX className="w-8 h-8 text-secondary mx-auto" />
                 <p className="text-sm font-medium text-secondary">No Assets Assigned</p>
               </div>
            ) : (
               <div className="space-y-3">
                 {safeAssets.map(asset => (
                   <div key={asset.id} className="bg-base/80 p-3.5 rounded-xl border border-border/80 flex items-center justify-between gap-3">
                     <div className="flex items-center gap-3 min-w-0">
                       <Badge badgeChar={asset.categoryBadgeChar || asset.categoryName?.[0] || '?'} color={asset.categoryColor} title={asset.categoryName} />
                       <div className="min-w-0">
                         <div className="text-sm font-bold text-primary truncate">{asset.name}</div>
                         <div className="flex items-center gap-2.5 text-xs text-secondary mt-0.5">
                           <span className="font-mono text-accent/90">{asset.serialNumber}</span>
                           {asset.model && <span className="truncate">· {asset.model}</span>}
                         </div>
                       </div>
                     </div>
                     <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                       <StatusPill status={asset.status} />
                       {asset.assignedDate && (
                         <span className="text-[11px] font-mono text-secondary flex items-center gap-1">
                           <Calendar className="w-3 h-3" /> {asset.assignedDate}
                         </span>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>

        {/* My Tickets */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-base/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
              <TicketIcon className="w-4 h-4 text-accent" />
              My Tickets
            </h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Raise Ticket
            </button>
          </div>
          <div className="p-4 flex-1">
             {ticketsLoading ? (
               <div className="animate-pulse space-y-3">
                 {[1,2,3].map(i => <div key={i} className="h-14 bg-base rounded-xl border border-border" />)}
               </div>
             ) : tickets.length === 0 ? (
               <div className="py-10 bg-base/40 rounded-xl border border-border/40 text-center space-y-2">
                 <p className="text-sm font-medium text-secondary">No Tickets Raised</p>
               </div>
             ) : (
               <div className="space-y-3">
                 {recentTickets.map(ticket => (
                    <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="bg-base/80 p-3.5 rounded-xl border border-border/80 flex items-center justify-between cursor-pointer hover:bg-raised/50">
                       <div className="min-w-0">
                         <div className="text-sm font-bold text-primary truncate">{ticket.title}</div>
                         <div className="text-xs text-secondary mt-0.5">{new Date(ticket.created_at).toLocaleDateString()}</div>
                       </div>
                       <div>
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider ${ticket.status === 'open' ? 'bg-error/10 text-error border-error/20' : ticket.status === 'in_progress' ? 'bg-warning/10 text-warning border-warning/20' : ticket.status === 'resolved' ? 'bg-success/10 text-success border-success/20' : 'bg-raised text-secondary border-border'}`}>
                           {ticket.status.replace('_', ' ')}
                         </span>
                       </div>
                    </div>
                 ))}
                 {tickets.length > 5 && (
                   <Link to="/tickets" className="block text-center text-xs font-medium text-accent hover:underline mt-4">
                     View All Tickets
                   </Link>
                 )}
               </div>
             )}
          </div>
        </div>
      </div>
      <CreateTicketModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={createTicket} />
      <TicketDetailsModal isOpen={!!selectedTicket} ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onUpdate={updateTicket} />
    </div>
  );
}
