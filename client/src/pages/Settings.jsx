import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">System Settings</h2>
        <p className="text-sm text-slate-400 mt-1">
          Configure Google Workspace directory sync and system preferences
        </p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        <SettingsIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-200">Settings Stub</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          Google Workspace OAuth configuration and manual/cron sync controls (`googleapis`) are scheduled for Phase 2 (Week 7).
        </p>
      </div>
    </div>
  );
};

export default Settings;
