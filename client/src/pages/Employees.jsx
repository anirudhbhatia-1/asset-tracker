import React from 'react';
import { Users } from 'lucide-react';

const Employees = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Employee Directory</h2>
        <p className="text-sm text-slate-400 mt-1">
          View team members, assigned hardware, and Google Workspace sync status
        </p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-200">Employee Directory Stub</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          The employee directory table with department/location filters, assigned asset count badges, and manual add modal will be built in Week 5.
        </p>
      </div>
    </div>
  );
};

export default Employees;
