import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Ticket, UserPlus, Briefcase, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { getAssets } from '../../api/assetsApi';
import { ticketsApi } from '../../api/ticketsApi';
import { onboardingApi } from '../../api/onboardingApi';
import { useAuth } from '../../context/AuthContext';

const QUEUES = [
  { key: 'it', label: 'IT' },
  { key: 'hardware', label: 'Hardware' },
  { key: 'hr', label: 'HR' },
];

const toList = (res) => res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
const errorMessage = (err) => err?.response?.data?.message || err?.message || 'Could not load';

// Each widget loads independently so one failing API never blanks the page.
function useWidgetData(loader, enabled) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      setState({ data: await loader(), loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: errorMessage(err) });
    }
  }, [loader, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

const loadCompanyAssets = async () => {
  // Client-owned assets are excluded, matching the company totals on the IT dashboard.
  const assets = toList(await getAssets({ assetType: 'company' }));
  return {
    total: assets.length,
    inUse: assets.filter((a) => a.status === 'in-use').length,
    available: assets.filter((a) => a.status === 'available').length,
  };
};

const loadClientAssets = async () => toList(await getAssets({ assetType: 'client' })).length;

const loadOpenTickets = async () => {
  const tickets = await ticketsApi.getAll({ scope: 'all' });
  const open = (Array.isArray(tickets) ? tickets : []).filter((t) => t.status === 'open' || t.status === 'in_progress');
  const byQueue = Object.fromEntries(QUEUES.map((q) => [q.key, 0]));
  open.forEach((t) => {
    if (byQueue[t.current_admin_type] !== undefined) byQueue[t.current_admin_type] += 1;
  });
  return { total: open.length, byQueue };
};

const loadOnboarding = () => onboardingApi.getHrMetrics();

function Widget({ title, icon: Icon, to, linkLabel, loading, error, onRetry, children, footnote }) {
  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-accent shrink-0" />
          <h2 className="text-sm font-semibold text-primary truncate">{title}</h2>
        </div>
        <Link to={to} className="text-xs text-accent hover:underline flex items-center gap-1 shrink-0">
          {linkLabel} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="p-4 flex-1">
        {loading ? (
          <div className="grid grid-cols-3 gap-3 animate-pulse">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-raised" />)}
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 text-xs text-danger">
            <span className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{error}</span>
            </span>
            <button type="button" onClick={onRetry} className="underline shrink-0 cursor-pointer">Retry</button>
          </div>
        ) : (
          children
        )}
      </div>
      {footnote && <p className="px-4 pb-3 text-[11px] text-secondary">{footnote}</p>}
    </div>
  );
}

function Stat({ label, value, to, tone = 'text-primary' }) {
  return (
    <Link to={to} className="block rounded-lg border border-border/60 hover:border-border hover:bg-raised transition-colors px-3 py-2">
      <div className={`text-xl font-bold ${tone}`}>{value ?? 0}</div>
      <div className="text-[11px] font-medium text-secondary uppercase tracking-wider mt-0.5">{label}</div>
    </Link>
  );
}

export default function ExecutiveOverview() {
  const { hasPermission } = useAuth();
  const canAssets = hasPermission('assets:read');
  const canTickets = hasPermission('tickets:read');
  const canOnboarding = hasPermission('onboarding:read');

  const company = useWidgetData(loadCompanyAssets, canAssets);
  const client = useWidgetData(loadClientAssets, canAssets);
  const tickets = useWidgetData(loadOpenTickets, canTickets);
  const onboarding = useWidgetData(loadOnboarding, canOnboarding);

  const anyLoading = company.loading || client.loading || tickets.loading || onboarding.loading;
  const refreshAll = () => {
    company.reload();
    client.reload();
    tickets.reload();
    onboarding.reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-surface hover:bg-raised text-secondary border border-border transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${anyLoading ? 'animate-spin text-accent' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canAssets && (
          <Widget
            title="Company Assets"
            icon={Archive}
            to="/inventory"
            linkLabel="Inventory"
            loading={company.loading}
            error={company.error}
            onRetry={company.reload}
          >
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total" value={company.data?.total} to="/inventory" />
              <Stat label="In Use" value={company.data?.inUse} to="/inventory?status=in-use" tone="text-info-blue" />
              <Stat label="Available" value={company.data?.available} to="/inventory?status=available" tone="text-success" />
            </div>
          </Widget>
        )}

        {canTickets && (
          <Widget
            title={`Open Tickets${tickets.data ? ` (${tickets.data.total})` : ''}`}
            icon={Ticket}
            to="/tickets"
            linkLabel="Tickets"
            loading={tickets.loading}
            error={tickets.error}
            onRetry={tickets.reload}
            footnote="Open and in-progress tickets by the queue that currently owns them."
          >
            <div className="grid grid-cols-3 gap-3">
              {QUEUES.map((q) => (
                <Stat
                  key={q.key}
                  label={q.label}
                  value={tickets.data?.byQueue[q.key]}
                  to="/tickets"
                  tone={tickets.data?.byQueue[q.key] ? 'text-warning' : 'text-primary'}
                />
              ))}
            </div>
          </Widget>
        )}

        {canOnboarding && (
          <Widget
            title="Onboarding"
            icon={UserPlus}
            to="/onboarding"
            linkLabel="Onboarding"
            loading={onboarding.loading}
            error={onboarding.error}
            onRetry={onboarding.reload}
          >
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Pending" value={Number(onboarding.data?.pending_onboardings) || 0} to="/onboarding" tone="text-warning" />
              <Stat label="Arranged this month" value={Number(onboarding.data?.arranged_this_month) || 0} to="/onboarding" tone="text-success" />
            </div>
          </Widget>
        )}

        {canAssets && (
          <Widget
            title="Client-Owned Assets"
            icon={Briefcase}
            to="/inventory?ownership=client"
            linkLabel="Client assets"
            loading={client.loading}
            error={client.error}
            onRetry={client.reload}
            footnote="Held on behalf of clients; not counted in company totals."
          >
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Recorded" value={client.data} to="/inventory?ownership=client" />
            </div>
          </Widget>
        )}
      </div>
    </div>
  );
}
