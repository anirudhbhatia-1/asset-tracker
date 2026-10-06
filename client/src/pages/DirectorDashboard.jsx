import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Users, Package, Ticket, ChevronRight, Layers } from 'lucide-react';
import Dashboard from './Dashboard';
import ExecutiveOverview from '../components/dashboard/ExecutiveOverview';
import HrDashboard from './HrDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import SegmentedControl from '../components/ui/SegmentedControl';
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
      <div className="bg-gradient-to-r from-accent/20 via-surface to-raised border border-accent/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-extrabold text-primary tracking-tight">Executive Super-Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent/20 text-accent uppercase tracking-wider border border-accent/40">
              System Director
            </span>
          </div>
          <p className="text-sm text-secondary mt-1">
            Cross-team summary, per-team dashboard views, and access control.
          </p>
        </div>

        <Link
          to="/settings/roles"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-on-accent text-sm font-semibold rounded-xl transition-all shadow-md shadow-accent/20 shrink-0"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Role Matrix Builder</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

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
