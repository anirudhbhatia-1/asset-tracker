import React from 'react';
import { LayoutDashboard, ShieldCheck, Activity, Laptop, Users } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time overview of hardware assets across office locations
          </p>
        </div>
      </div>

      {/* Placeholder KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Assets', val: '15', sub: 'Across 4 categories', icon: Laptop, color: 'indigo' },
          { label: 'Available', val: '5', sub: 'Ready for assignment', icon: ShieldCheck, color: 'emerald' },
          { label: 'In Use', val: '8', sub: 'Assigned to employees', icon: Activity, color: 'amber' },
          { label: 'Employees', val: '8', sub: 'Across 4 locations', icon: Users, color: 'purple' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-400">{kpi.label}</span>
                <div className={`w-10 h-10 rounded-lg bg-${kpi.color}-500/10 border border-${kpi.color}-500/20 flex items-center justify-center text-${kpi.color}-400`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-100">{kpi.val}</span>
                <span className="block text-xs text-slate-400 mt-1">{kpi.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        <p className="font-medium text-slate-300">Phase 1 Foundation Setup Complete</p>
        <p className="text-xs text-slate-500 mt-1">
          Full Dashboard KPI charts, quick assignment modals, and activity feeds will be populated in Week 3.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
