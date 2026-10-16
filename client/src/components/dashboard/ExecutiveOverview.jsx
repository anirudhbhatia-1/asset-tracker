import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Ticket, UserPlus, Briefcase, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { getAssets } from '../../api/assetsApi';
import { ticketsApi } from '../../api/ticketsApi';
import { onboardingApi } from '../../api/onboardingApi';
import { useAuth } from '../../context/AuthContext';
import { ticketsLink } from '../../utils/ticketQueue';
import Button from '../ui/Button';
import Card, { CardBody, CardHeader } from '../ui/Card';

const QUEUES = [
  { key: 'it', label: 'IT' },
  { key: 'hardware', label: 'Admin' },
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
    <Card>
      <CardHeader
        icon={Icon}
        title={title}
        actions={(
          <Link to={to} className="text-xs text-accent hover:underline flex items-center gap-1 shrink-0">
            {linkLabel} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      />
      <CardBody>
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
            <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>
          </div>
        ) : (
          children
        )}
      </CardBody>
      {footnote && <p className="px-4 pb-3 text-xs text-secondary">{footnote}</p>}
    </Card>
  );
}

function Stat({ label, value, to, tone = 'text-primary' }) {
  return (
    <Link to={to} className="block rounded-lg border border-border/60 hover:border-border hover:bg-raised transition-colors px-3 py-2">
      <div className={`text-xl font-bold tabular-nums ${tone}`}>{value ?? 0}</div>
      <div className="text-xs font-medium text-secondary uppercase tracking-wider mt-0.5">{label}</div>
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
        <Button variant="secondary" size="sm" onClick={refreshAll}>
          <RefreshCw className={`w-3.5 h-3.5 ${anyLoading ? 'animate-spin text-accent' : ''}`} aria-hidden="true" />
          <span>Refresh Data</span>
        </Button>
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
            to={ticketsLink({ status: 'active' })}
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
                  to={ticketsLink({ status: 'active', view: 'all', queue: q.key })}
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
