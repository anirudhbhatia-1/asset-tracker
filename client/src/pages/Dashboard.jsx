import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useMetrics from '../hooks/useMetrics';
import { useTickets } from '../hooks/useTickets';
import MetricCard from '../components/dashboard/MetricCard';
import InventoryBreakdown from '../components/dashboard/InventoryBreakdown';
import GoogleBanner from '../components/dashboard/GoogleBanner';
import { SkeletonCard } from '../components/ui/Skeleton';
import { PackageCheck, Users, AlertCircle, Archive, RefreshCw, AlertTriangle, Plus, CheckCircle2, ArrowRight } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { metrics, breakdown, breakdownByLocation, breakdownByStatus, breakdownByWarranty, lowStockCategories, loading: metricsLoading, error: metricsError, refresh: refreshMetrics } = useMetrics();
  const { tickets, loading: ticketsLoading, error: ticketsError, fetchTickets } = useTickets();

  useEffect(() => {
    if (hasPermission('tickets:read')) {
      fetchTickets({ scope: 'all' });
    }
  }, [fetchTickets, hasPermission]);

  const handleRefresh = () => {
    refreshMetrics();
    if (hasPermission('tickets:read')) {
      fetchTickets({ scope: 'all' });
    }
  };

  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const pendingTickets = tickets.filter(t => t.status === 'open').slice(0, 5);

  const activePercentage = metrics.total ? Math.round((metrics.inUse / metrics.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">IT Asset Dashboard</h1>
          <p className="text-sm text-secondary mt-1">
            Live snapshot of fleet health, pending actions, and inventory alerts.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-center">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-surface hover:bg-raised text-secondary border border-border transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading || ticketsLoading ? 'animate-spin text-accent' : ''}`} />
            <span>Refresh Data</span>
          </button>
          {hasPermission('assets:create') && (
            <button
              type="button"
              onClick={() => navigate('/inventory/new')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-accent hover:bg-accent/90 text-white border border-transparent transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Asset</span>
            </button>
          )}
        </div>
      </div>

      {/* Error banner if fetching failed */}
      {(metricsError || ticketsError) && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm text-danger flex items-center justify-between">
          <span>{metricsError || ticketsError}</span>
          <button onClick={handleRefresh} className="underline text-xs hover:text-white cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* 1. TIER 1 — KPI Cards (Top Row) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {metricsLoading || ticketsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
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
            <MetricCard
              title="Open Tickets"
              count={openTickets.length}
              icon={AlertCircle}
              subtitle="Require attention"
              colorClass="text-warning bg-warning/10 border-warning/20"
              onClick={() => navigate('/tickets')}
            />
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

      {/* Google Workspace Sync Banner */}
      <GoogleBanner />

      {/* 2. TIER 2 — "Requires Attention" Widgets (Middle Row) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget A: Pending Tickets */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <h2 className="text-sm font-semibold text-primary">Open Tickets</h2>
            </div>
            <button onClick={() => navigate('/tickets')} className="text-xs text-accent hover:underline flex items-center gap-1 cursor-pointer">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4 flex-1">
            {pendingTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-success mb-2" />
                <p className="text-sm font-medium text-primary">All Clear</p>
                <p className="text-xs text-secondary mt-1">No pending tickets require attention.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTickets.map(ticket => (
                  <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:border-border hover:bg-raised transition-colors cursor-pointer group" onClick={() => navigate('/tickets')}>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium text-primary truncate">{ticket.title}</p>
                      <p className="text-xs text-secondary mt-0.5">{ticket.employeeName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                        ticket.type === 'issue' ? 'bg-error/10 text-error' : 'bg-info-blue/10 text-info-blue'
                      }`}>
                        {ticket.type}
                      </span>
                      <ArrowRight className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Widget B: Low Stock Alert */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-semibold text-primary">Low Stock Alert</h2>
          </div>
          <div className="p-4 flex-1">
            {(!lowStockCategories || lowStockCategories.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <PackageCheck className="w-8 h-8 text-success mb-2" />
                <p className="text-sm font-medium text-primary">Stock levels healthy</p>
                <p className="text-xs text-secondary mt-1">All categories have sufficient available assets.</p>
              </div>
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
          </div>
        </div>
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
