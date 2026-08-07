import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Activity, Users, Package, Ticket, ChevronRight, Layers } from 'lucide-react';
import Dashboard from './Dashboard';
import HrDashboard from './HrDashboard';
import EmployeeDashboard from './EmployeeDashboard';

export default function DirectorDashboard() {
  const [activeTab, setActiveTab] = useState('executive');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-accent/20 via-surface to-raised border border-accent/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-accent" />
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Executive Super-Dashboard</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent/20 text-accent uppercase tracking-wider border border-accent/40">
              System Director
            </span>
          </div>
          <p className="text-sm text-secondary mt-1">
            System-wide visibility, module-level dashboard view switching, and access control matrix controls.
          </p>
        </div>

        <Link
          to="/settings/roles"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-accent/20 shrink-0"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Role Matrix Builder</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Mode View Switcher Tabs */}
      <div className="border-b border-border/80 pb-2">
        <nav className="flex space-x-4 overflow-x-auto" aria-label="Director View Modes">
          <button
            onClick={() => setActiveTab('executive')}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'executive'
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-surface'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Executive Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'admin'
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-surface'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>IT Admin View</span>
          </button>

          <button
            onClick={() => setActiveTab('hr')}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'hr'
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-surface'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>HR Partner View</span>
          </button>

          <button
            onClick={() => setActiveTab('employee')}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'employee'
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-surface'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>My Employee Self-Service</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'executive' && <Dashboard />}
        {activeTab === 'admin' && <Dashboard />}
        {activeTab === 'hr' && <HrDashboard />}
        {activeTab === 'employee' && <EmployeeDashboard />}
      </div>
    </div>
  );
}
