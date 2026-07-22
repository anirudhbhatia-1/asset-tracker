import React from 'react';
import { User, Mail, Building2, MapPin, ShieldCheck, Laptop, Trash2 } from 'lucide-react';

export default function EmployeeCard({ employee, onClick, onDelete }) {
  if (!employee) return null;

  const initials = employee.name
    ? employee.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : '??';

  const assignedCount = employee.assignedAssetCount || 0;

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(employee);
  };

  return (
    <div
      onClick={() => onClick && onClick(employee)}
      className="bg-slate-800 rounded-2xl border border-slate-700/80 p-5 shadow-sm hover:border-slate-600/80 hover:bg-slate-800/90 transition-all cursor-pointer group flex flex-col justify-between h-full relative overflow-hidden"
    >
      {/* Top Section: Avatar & Verified Badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-700/80 border border-slate-600/70 flex items-center justify-center text-slate-100 font-bold text-base shadow-inner overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
          {employee.avatarUrl ? (
            <img src={employee.avatarUrl} alt={employee.name} className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {employee.isGoogleSynced === 1 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              title="Verified & synced from Google Workspace Directory"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Synced</span>
            </span>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-700/60 opacity-0 group-hover:opacity-100 transition-all"
              title="Delete employee profile"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Middle Section: Name & Email */}
      <div className="space-y-1 mb-4 min-w-0">
        <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
          {employee.name}
        </h3>
        {employee.email && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{employee.email}</span>
          </p>
        )}
      </div>

      {/* Bottom Section: Department, Location & Asset Count */}
      <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3 text-slate-300 min-w-0 truncate">
          {employee.department && (
            <span className="inline-flex items-center gap-1 truncate font-medium">
              <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{employee.department}</span>
            </span>
          )}
          {employee.location && (
            <span className="inline-flex items-center gap-1 text-slate-400 shrink-0">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{employee.location}</span>
            </span>
          )}
        </div>

        {/* Assigned Hardware Count Badge */}
        <div
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono font-medium text-xs shrink-0 ${
            assignedCount > 0
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              : 'bg-slate-900/60 text-slate-500 border border-slate-700/60'
          }`}
          title={`${assignedCount} assigned hardware items`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>{assignedCount}</span>
        </div>
      </div>
    </div>
  );
}
