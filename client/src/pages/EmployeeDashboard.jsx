import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getEmployeeAssets } from '../api/employeesApi';
import { useTickets } from '../hooks/useTickets';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import Badge from '../components/ui/Badge';
import StatusPill from '../components/ui/StatusPill';
import { Laptop, Ticket as TicketIcon, Calendar, Plus, PackageX, Package, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import CreateTicketModal from '../components/forms/CreateTicketModal';
import TicketDetailsModal from '../components/tickets/TicketDetailsModal';
import ReopenTicketModal from '../components/tickets/ReopenTicketModal';
import { onActivateKey } from '../utils/a11y';
import { useStockHoldings } from '../hooks/useStock';
import { holdingLabel } from '../utils/stock';
import { formatDate } from '../utils/formatters';
import { queueLabel, ticketRef } from '../utils/ticketMeta';
import { ticketsLink } from '../utils/ticketQueue';
import TicketStatusBadge, { PriorityBadge, TicketTypeBadge } from '../components/tickets/TicketStatusBadge';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

// Dashboard ticket order: waiting for your confirmation, then still open.
const TICKET_ORDER = { resolved: 0, open: 1, in_progress: 1 };
import MyAssetModal from '../components/asset-detail/MyAssetModal';

// `embedded` hides the page title when rendered inside another dashboard (Director view).
export default function EmployeeDashboard({ embedded = false }) {
  const { user, hasPermission } = useAuth();
  const canViewAssets = hasPermission('assets:read');
  const canReadTickets = hasPermission('tickets:read');
  const canRaiseTicket = hasPermission('tickets:create');
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState(null);
  // Bumped by Retry to run the assets load again.
  const [assetsAttempt, setAssetsAttempt] = useState(0);
  // Bulk items (bags, cables…) the person holds; the list hides when empty.
  const { holdings: bulkHoldings } = useStockHoldings(user?.id ? 'me' : null);
  
  const {
    tickets, loading: ticketsLoading, fetchTickets, createTicket, updateTicket,
    transferTicket, confirmCloseTicket, reopenTicket,
  } = useTickets();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [ticketInitialParams, setTicketInitialParams] = useState({ type: 'issue', assetId: '' });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [reopeningTicket, setReopeningTicket] = useState(null);
  const [viewingAsset, setViewingAsset] = useState(null);
  // Ticket whose Confirm & Close is in flight; its buttons stay disabled meanwhile.
  const [closingTicketId, setClosingTicketId] = useState(null);

  const reportIssue = (asset) => {
    setViewingAsset(null);
    setTicketInitialParams({ type: 'issue', assetId: asset.id });
    setIsCreateModalOpen(true);
  };

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setAssetsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setAssetsLoading(true);
    setAssetsError(null);
    getEmployeeAssets(userId)
      .then(res => { if (!cancelled) setAssets(res.data?.data || []); })
      .catch(err => {
        console.error("Failed to fetch assets", err);
        // Shown in the card, so a failed load doesn't read as "No Assets Assigned".
        if (!cancelled) setAssetsError(err.response?.data?.message || err.message || 'Failed to load assets');
      })
      .finally(() => { if (!cancelled) setAssetsLoading(false); });
    return () => { cancelled = true; };
  }, [userId, assetsAttempt]);

  useEffect(() => {
    if (canReadTickets) {
      // "My Tickets": for ticket resolvers the default scope is their queue.
      fetchTickets({ scope: 'my_tickets' });
    }
  }, [fetchTickets, canReadTickets]);

  const handleConfirmClose = async (ticketId) => {
    if (closingTicketId) return;
    setClosingTicketId(ticketId);
    try {
      await confirmCloseTicket(ticketId);
    } catch {
      // useTickets already showed the error toast.
    } finally {
      setClosingTicketId(null);
    }
  };

  // Resolved tickets waiting for the person's confirmation come first, then
  // open ones, newest first within each.
  const recentTickets = [...tickets]
    .sort((a, b) => (TICKET_ORDER[a.status] ?? 3) - (TICKET_ORDER[b.status] ?? 3)
      || new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);
  const safeAssets = Array.isArray(assets) ? assets : [];
  const raiseTicket = () => {
    setTicketInitialParams({ type: 'issue', assetId: '' });
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {!embedded && (
        <PageHeader
          title={`Welcome, ${user?.name || user?.roleName || 'Employee'}`}
          subtitle="Your devices and support requests."
        />
      )}

      {!embedded && <AttentionPanel />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Assets */}
        <Card aria-labelledby="my-assets-title">
          <CardHeader id="my-assets-title" icon={Laptop} title="My Assets" />
          <CardBody className="lg:max-h-[500px] lg:overflow-y-auto">
            {assetsLoading ? (
               <div className="animate-pulse space-y-3">
                 {[1,2].map(i => <div key={i} className="h-16 bg-base rounded-xl border border-border" />)}
               </div>
            ) : assetsError ? (
               <div role="alert" className="py-6 bg-base/40 rounded-xl border border-border/40 text-center space-y-2">
                 <AlertCircle className="w-6 h-6 text-danger mx-auto" aria-hidden="true" />
                 <p className="text-sm font-medium text-secondary">Couldn't load your assets.</p>
                 <Button variant="ghost" size="sm" onClick={() => setAssetsAttempt(n => n + 1)}>Retry</Button>
               </div>
            ) : safeAssets.length === 0 ? (
               <EmptyState size="sm" icon={PackageX} title="No Assets Assigned" description="Devices IT gives you will show up here." />
            ) : (
               <ul className="space-y-3">
                  {safeAssets.map(asset => (
                    <li key={asset.id} className="bg-base/80 p-3.5 rounded-xl border border-border/80 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        {/* Opens the person's own view: specs, and price + policy for client assets. */}
                        <button
                          type="button"
                          onClick={() => setViewingAsset(asset)}
                          aria-label={`View details of ${asset.name}`}
                          className="flex items-center gap-3 min-w-0 flex-1 group text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Badge badgeChar={asset.categoryBadgeChar || asset.categoryName?.[0] || '?'} color={asset.categoryColor} title={asset.categoryName} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-primary truncate group-hover:text-accent transition-colors">{asset.name}</div>
                            <div className="flex items-center gap-2.5 text-xs text-secondary mt-0.5">
                              <span className="font-mono text-accent">{asset.serialNumber}</span>
                              {asset.model && <span className="truncate">· {asset.model}</span>}
                            </div>
                          </div>
                        </button>
                        <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                          <StatusPill status={asset.status} />
                          {asset.assignedDate && (
                            <span className="text-xs text-secondary flex items-center gap-1">
                              <Calendar className="w-3 h-3" aria-hidden="true" /> {formatDate(asset.assignedDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      {canRaiseTicket && (
                      <div className="pt-2 border-t border-border/50 flex justify-end">
                        <Button variant="danger-outline" size="sm" onClick={() => reportIssue(asset)}>
                          Report Issue
                        </Button>
                      </div>
                      )}
                    </li>
                  ))}
               </ul>
            )}
            {bulkHoldings.length > 0 && (
              <section aria-labelledby="my-bulk-items-title" className="mt-4 pt-4 border-t border-border/60">
                <h3 id="my-bulk-items-title" className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-2 mb-2.5">
                  <Package className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                  Other items
                </h3>
                <ul className="space-y-2">
                  {bulkHoldings.map((holding) => (
                    <li key={holding.stockItemId} className="bg-base/80 px-3.5 py-2.5 rounded-xl border border-border/80 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-primary break-words">{holdingLabel(holding)}</span>
                      {holding.firstAssignedAt && (
                        <span className="text-xs text-secondary">Since {formatDate(holding.firstAssignedAt)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </CardBody>
        </Card>

        {/* My Tickets (hidden without tickets:read) */}
        {canReadTickets && (
        <Card aria-labelledby="my-tickets-title">
          <CardHeader
            id="my-tickets-title"
            icon={TicketIcon}
            title="My Tickets"
            actions={canRaiseTicket && (
              <Button size="sm" onClick={raiseTicket}>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Raise Ticket
              </Button>
            )}
          />
          <CardBody className="lg:max-h-[500px] lg:overflow-y-auto">
             {ticketsLoading ? (
               <div className="animate-pulse space-y-3">
                 {[1,2,3].map(i => <div key={i} className="h-14 bg-base rounded-xl border border-border" />)}
               </div>
             ) : tickets.length === 0 ? (
               <EmptyState
                 size="sm"
                 icon={TicketIcon}
                 title="No Tickets Yet"
                 description="Something not working, or need equipment? Raise a ticket."
                 actionText={canRaiseTicket ? 'Raise a Ticket' : undefined}
                 onAction={canRaiseTicket ? raiseTicket : undefined}
               />
             ) : (
               <ul className="space-y-3">
                 {recentTickets.map(ticket => (
                    <li key={ticket.id} className={`rounded-xl border flex flex-col gap-3 transition-colors ${ticket.status === 'closed' ? 'bg-base/40 border-border/40' : 'bg-base/80 border-border/80 hover:bg-raised/50'}`}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ticket ${ticketRef(ticket)}: ${ticket.title}`}
                        onClick={() => setSelectedTicket(ticket)}
                        onKeyDown={onActivateKey(() => setSelectedTicket(ticket))}
                        className="p-3.5 pb-0 last:pb-3.5 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="font-mono text-xs text-secondary">{ticketRef(ticket)}</span>
                              <TicketTypeBadge type={ticket.type} />
                              <span className="text-xs text-secondary truncate">· {queueLabel(ticket.current_admin_type)}</span>
                            </div>
                            <div className="text-sm font-semibold text-primary truncate">{ticket.title}</div>
                            <div className="text-xs text-secondary mt-0.5">{formatDate(ticket.created_at)}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <TicketStatusBadge status={ticket.status} />
                            {['high', 'urgent'].includes(ticket.priority) && <PriorityBadge priority={ticket.priority} />}
                          </div>
                        </div>

                        {ticket.resolution_notes && (
                          <div className="text-xs text-secondary bg-surface p-2 rounded-lg border border-border/50 truncate mt-3">
                            <span className="font-semibold text-primary mr-1">Resolution:</span>
                            {ticket.resolution_notes}
                          </div>
                        )}
                      </div>

                      {ticket.status === 'resolved' && (
                        <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3.5">
                          <span className="text-xs text-secondary mr-auto">Fixed? Let them know.</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReopeningTicket(ticket)}
                            disabled={closingTicketId === ticket.id}
                          >
                            Reopen
                          </Button>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleConfirmClose(ticket.id)}
                            loading={closingTicketId === ticket.id}
                          >
                            {closingTicketId === ticket.id ? 'Closing…' : 'Confirm & Close'}
                          </Button>
                        </div>
                      )}
                    </li>
                 ))}
               </ul>
             )}
             {tickets.length > 5 && (
               <Link to={ticketsLink({ view: 'my_tickets' })} className="block text-center text-xs font-medium text-accent hover:underline mt-4">
                 View all {tickets.length} tickets
               </Link>
             )}
          </CardBody>
        </Card>
        )}
      </div>
      <CreateTicketModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSubmit={createTicket} 
        initialType={ticketInitialParams.type}
        initialAssetId={ticketInitialParams.assetId}
      />
      <TicketDetailsModal
        isOpen={!!selectedTicket}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdate={updateTicket}
        onTransfer={transferTicket}
        onConfirmClose={confirmCloseTicket}
        onReopen={(ticket) => {
          setSelectedTicket(null);
          setReopeningTicket(ticket);
        }}
      />
      <MyAssetModal
        asset={viewingAsset}
        onClose={() => setViewingAsset(null)}
        canOpenFullPage={canViewAssets}
        onReportIssue={canRaiseTicket ? reportIssue : undefined}
      />
      <ReopenTicketModal ticket={reopeningTicket} onClose={() => setReopeningTicket(null)} onReopen={reopenTicket} />
    </div>
  );
}
