import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Users, Package, Ticket, ChevronRight, Layers } from 'lucide-react';
import Dashboard from './Dashboard';
import ExecutiveOverview from '../components/dashboard/ExecutiveOverview';
import HrDashboard from './HrDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import SegmentedControl from '../components/ui/SegmentedControl';
import PageHeader from '../components/ui/PageHeader';
import Pill from '../components/ui/Pill';
import { withSearchParam } from '../utils/searchParams';

const TABS = [
  { value: 'executive', label: 'Executive Overview', icon: Layers },
  { value: 'admin', label: 'IT Admin View', icon: Package },
  { value: 'hr', label: 'HR Partner View', icon: Users },
  { value: 'employee', label: 'My Employee Self-Service', icon: Ticket },
];
const DEFAULT_TAB = 'executive';

export default function DirectorDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = TABS.some((t) => t.value === requestedTab) ? requestedTab : DEFAULT_TAB;
  // Default tab keeps a clean URL; switching replaces the entry so Back
  // leaves the dashboard instead of stepping through tabs.
  const setActiveTab = (tab) => {
    setSearchParams((prev) => withSearchParam(prev, 'tab', tab === DEFAULT_TAB ? '' : tab), { replace: true });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-fadeIn">
      {/* Header Banner */}
      <PageHeader
        className="bg-gradient-to-r from-accent/20 via-surface to-raised border border-accent/30 rounded-2xl p-6 shadow-xl"
        icon={ShieldCheck}
        title="Executive Super-Dashboard"
        subtitle="Cross-team summary, per-team dashboard views, and access control."
        actions={(
          <Link
            to="/settings/roles"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-on-accent text-sm font-semibold rounded-xl transition-all shadow-md shadow-accent/20 shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Role Matrix Builder</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      >
        <Pill tone="accent" size="md" className="mt-2 uppercase tracking-wider">System Director</Pill>
      </PageHeader>

      {/* Shown once for every tab (embedded dashboards leave theirs out). */}
      <AttentionPanel />

      {/* Mode View Switcher Tabs (selected view is kept in the URL as ?tab=) */}
      <div className="border-b border-border/80 pb-3">
        <SegmentedControl
          label="Director view modes"
          value={activeTab}
          onChange={setActiveTab}
          options={TABS}
        />
      </div>

      {/* Tab Content — embedded dashboards hide their own title so this page has one header */}
      <div className="mt-4" role="tabpanel" aria-label={TABS.find((t) => t.value === activeTab)?.label}>
        {activeTab === 'executive' && <ExecutiveOverview />}
        {activeTab === 'admin' && <Dashboard embedded />}
        {activeTab === 'hr' && <HrDashboard embedded />}
        {activeTab === 'employee' && <EmployeeDashboard embedded />}
      </div>
    </div>
  );
}
