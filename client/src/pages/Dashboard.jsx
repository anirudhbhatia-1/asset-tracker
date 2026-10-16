import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useMetrics from '../hooks/useMetrics';
import { useTickets } from '../hooks/useTickets';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import MetricCard from '../components/dashboard/MetricCard';
import InventoryBreakdown from '../components/dashboard/InventoryBreakdown';
import { SkeletonCard } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import { PackageCheck, Users, AlertCircle, Archive, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { PriorityBadge, TicketAgeBadge } from '../components/tickets/TicketStatusBadge';
import { sortTickets, ticketsLink } from '../utils/ticketQueue';
import { ticketRef } from '../utils/ticketMeta';

// `embedded` hides the page title when rendered inside another dashboard (Director view).
export default function Dashboard({ embedded = false }) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canReadTickets = hasPermission('tickets:read');
  const { metrics, breakdown, breakdownByLocation, breakdownByStatus, breakdownByWarranty, lowStockCategories, loading: metricsLoading, error: metricsError, refresh: refreshMetrics } = useMetrics();
  const { tickets, loading: rawTicketsLoading, error: ticketsError, fetchTickets } = useTickets();
  // Without tickets:read nothing is fetched, so the hook never leaves its loading state.
  const ticketsLoading = rawTicketsLoading && canReadTickets;

  useEffect(() => {
    if (canReadTickets) {
      fetchTickets({ scope: 'all' });
    }
  }, [fetchTickets, canReadTickets]);

  const handleRefresh = () => {
    refreshMetrics();
    if (canReadTickets) {
      fetchTickets({ scope: 'all' });
    }
  };

  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  // Waiting on someone, most urgent and longest-waiting first.
  const pendingTickets = sortTickets(openTickets, 'priority').slice(0, 5);

  const activePercentage = metrics.total ? Math.round((metrics.inUse / metrics.total) * 100) : 0;

  // Five cards: 3 + 2 on tablets, one row on wide screens, and on phones the
  // odd last card spans both columns instead of sitting alone. Four cards
  // (no tickets access): 2 + 2, then one row.
  const kpiGridClass = canReadTickets
    ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1'
    : 'grid-cols-2 xl:grid-cols-4';

  const refreshButton = (
    <Button variant="secondary" size="sm" onClick={handleRefresh}>
      <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading || ticketsLoading ? 'animate-spin text-accent' : ''}`} aria-hidden="true" />
      <span>Refresh Data</span>
    </Button>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header — the global TopBar owns the primary "Add Asset" action */}
      {embedded ? (
        <div className="flex justify-end">{refreshButton}</div>
      ) : (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-1.5">Fleet operations</p>
          <PageHeader
            title="IT Asset Dashboard"
            subtitle="Live snapshot of fleet health, pending actions, and inventory alerts."
            actions={refreshButton}
          />
        </div>
      )}

      {/* What to act on first (the Director page shows its own above the tabs). */}
      {!embedded && <AttentionPanel />}

      {/* Error banner if fetching failed */}
      {(metricsError || ticketsError) && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm text-danger flex items-center justify-between">
          <span>{metricsError || ticketsError}</span>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            Retry
          </Button>
        </div>
      )}

      {/* 1. TIER 1 — KPI Cards (Top Row) */}
      <div className={`grid ${kpiGridClass} gap-4`}>
        {metricsLoading || ticketsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            {canReadTickets && <SkeletonCard />}
          </>
        ) : (
          <>
            <MetricCard
              title="Total Assets"
              count={metrics.total}
              icon={Archive}
              subtitle="All fleet assets"
              colorClass="text-accent bg-accent/10 border-accent/20"
              onClick={() => navigate('/inventory')}
            />
            <MetricCard
              title="Available to Deploy"
              count={metrics.available}
              icon={PackageCheck}
              subtitle="Ready in stockroom"
              colorClass="text-success bg-success/10 border-success/20"
              onClick={() => navigate('/inventory?status=available')}
            />
            <MetricCard
              title="In Use / Assigned"
              count={metrics.inUse}
              icon={Users}
              subtitle={`${activePercentage}% of fleet active`}
              colorClass="text-info-blue bg-info-blue/10 border-info-blue/20"
              onClick={() => navigate('/inventory?status=in-use')}
            />
            {canReadTickets && (
            <MetricCard
              title="Open Tickets"
              count={openTickets.length}
              icon={AlertCircle}
              subtitle="Require attention"
              colorClass="text-warning bg-warning/10 border-warning/20"
              onClick={() => navigate(ticketsLink({ status: 'active', view: 'all' }))}
            />
            )}
            <MetricCard
              title="Retired / EOL"
              count={metrics.retired}
              icon={Archive}
              subtitle="End of life"
              colorClass="text-secondary bg-secondary/10 border-secondary/20"
              onClick={() => navigate('/inventory?status=retired')}
            />
          </>
        )}
      </div>

      {/* 2. TIER 2 — "Requires Attention" Widgets (Middle Row) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget A: Pending Tickets (hidden without tickets:read) */}
        {canReadTickets && (
        <Card>
          <CardHeader
            icon={AlertCircle}
            title="Open Tickets"
            actions={(
              <Link to={ticketsLink({ status: 'active', view: 'all' })} className="text-xs text-accent hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            )}
          />
          <CardBody>
            {pendingTickets.length === 0 ? (
              <EmptyState size="sm" icon={CheckCircle2} title="All Clear" description="No pending tickets require attention." />
            ) : (
              <div className="space-y-3">
                {pendingTickets.map(ticket => (
                  <Link key={ticket.id} to={`/tickets?ticket=${ticket.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:border-border hover:bg-raised transition-colors cursor-pointer group">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium text-primary truncate">{ticket.title}</p>
                      <p className="text-xs text-secondary mt-0.5 truncate">
                        <span className="font-mono">{ticketRef(ticket)}</span>{ticket.employee_name ? ` · ${ticket.employee_name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <PriorityBadge priority={ticket.priority} />
                      <TicketAgeBadge ticket={ticket} />
                      <ArrowRight className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
        )}

        {/* Widget B: Low Stock Alert (full width when it's the only widget) */}
        <Card className={canReadTickets ? '' : 'lg:col-span-2'}>
          <CardHeader icon={AlertTriangle} title="Low Stock Alert" />
          <CardBody>
            {(!lowStockCategories || lowStockCategories.length === 0) ? (
              <EmptyState size="sm" icon={PackageCheck} title="Stock levels healthy" description="All categories have sufficient available assets." />
            ) : (
              <div className="space-y-3">
                {lowStockCategories.map(cat => (
                  <div key={cat.id || cat.name} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-raised transition-colors">
                    <span className="text-sm font-medium text-primary">{cat.name}</span>
                    <span className="text-sm font-medium text-warning flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Only {cat.available} available
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* 3. TIER 3 — Bottom Row (Charts) */}
      <div className="w-full">
        <InventoryBreakdown 
          breakdown={breakdown} 
          breakdownByLocation={breakdownByLocation}
          breakdownByStatus={breakdownByStatus}
          breakdownByWarranty={breakdownByWarranty}
          loading={metricsLoading} 
        />
      </div>
    </div>
  );
}
