import React from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Building2, Calendar, CheckCircle2, Shield } from 'lucide-react';

export default function AssigneeCard({ asset }) {
  if (!asset || asset.status !== 'in-use' || !asset.assignedTo) {
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-blue-500/30 p-6 shadow-sm relative overflow-hidden">
      {/* Subtle top accent strip for assigned state */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <h3 className="text-base font-semibold text-slate-100">Current Assignee Profile</h3>
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
          Active Assignment
        </span>
      </div>

      <div className="flex items-start gap-4">
        {/* Avatar / Initials */}
        <div className="w-12 h-12 rounded-xl bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-200 font-bold text-base shrink-0 shadow-inner">
          {asset.assigneeAvatarUrl ? (
            <img src={asset.assigneeAvatarUrl} alt={asset.assigneeName} className="w-full h-full rounded-xl object-cover" />
          ) : (
            <span>
              {asset.assigneeName
                ? asset.assigneeName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                : <User className="w-6 h-6 text-slate-400" />}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <Link
              to={`/employees`}
              className="text-base font-bold text-slate-100 hover:text-indigo-400 transition-colors block truncate"
            >
              {asset.assigneeName || 'Unknown Employee'}
            </Link>
            {asset.assigneeEmail && (
              <span className="text-xs text-slate-400 inline-flex items-center gap-1.5 truncate mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{asset.assigneeEmail}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300 pt-1">
            {asset.assigneeDepartment && (
              <span className="inline-flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{asset.assigneeDepartment}</span>
              </span>
            )}
            {asset.assignedDate && (
              <span className="inline-flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Since: {asset.assignedDate}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
