import React, { memo } from 'react';
import { User, Mail, Building2, MapPin, ShieldCheck, Laptop, Trash2, Key, Edit3 } from 'lucide-react';

const toTitleCase = (str) => {
  if (!str) return '';
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const EmployeeCard = memo(function EmployeeCard({ employee, onClick, onDelete }) {
  if (!employee) return null;

  const displayName = toTitleCase(employee.name);
  const isServiceAccount = ['admin@company.com', 'hardwareadmin@company.com', 'hr@company.com', 'testsync@company.com'].includes(employee.email?.toLowerCase());

  const initials = displayName
    ? displayName
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

  const handleEditRole = (e) => {
    e.stopPropagation();
    if (onClick && employee.hasLogin !== undefined) {
      onClick(employee, 'role');
    }
  };

  const roleColors = {
    admin: 'bg-danger/10 text-danger border-danger/30',
    hr: 'bg-warning/10 text-warning border-warning/30',
    employee: 'bg-info-blue/10 text-info-blue border-info-blue/30',
  };

  return (
    <div
      onClick={() => onClick && onClick(employee)}
      className="bg-surface rounded-2xl border border-border/80 p-5 shadow-sm hover:border-border/80 hover:bg-surface/90 transition-all cursor-pointer group flex flex-col justify-between h-full relative overflow-hidden"
    >
      {/* Top Section: Avatar & Verified Badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-raised/80 border border-border/70 flex items-center justify-center text-primary font-bold text-base shadow-inner overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
          {employee.avatarUrl ? (
            <img src={employee.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isServiceAccount ? (
             <span
             className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface text-primary border border-primary/20"
             title="System Service Account"
           >
             <ShieldCheck className="w-3 h-3 text-accent" />
             <span>Service Account</span>
           </span>
          ) : (
            <>
              {employee.isGoogleSynced === 1 && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30"
                  title="Verified & synced from Google Workspace Directory"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Synced</span>
                </span>
              )}

              {employee.hasLogin ? (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${roleColors[employee.role] || 'bg-base text-secondary border-border'}`}
                >
                  <Key className="w-3 h-3" />
                  <span>{employee.role}</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-base/60 text-secondary/70 border border-border/50"
                >
                  <User className="w-3 h-3" />
                  <span>No Login</span>
                </span>
              )}
            </>
          )}

          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
            <button
              type="button"
              onClick={handleEditRole}
              className="p-1.5 rounded-lg text-secondary hover:text-accent hover:bg-raised/60 transition-all"
              title="Manage Login & Role"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 rounded-lg text-secondary hover:text-danger hover:bg-raised/60 transition-all"
                title="Delete employee profile"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Middle Section: Name & Email */}
      <div className="space-y-1 mb-4 min-w-0">
        <h3 className="text-base font-bold text-primary group-hover:text-accent transition-colors truncate">
          {displayName}
        </h3>
        {employee.email && (
          <p className="text-xs text-secondary flex items-center gap-1.5 truncate">
            <Mail className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span className="truncate">{employee.email}</span>
          </p>
        )}
      </div>

      {/* Bottom Section: Department, Location & Asset Count */}
      <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3 text-secondary min-w-0">
          <span className={`inline-flex items-center gap-1 min-w-0 font-medium ${!employee.department && 'opacity-60'}`}>
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{employee.department || 'No Dept'}</span>
          </span>
          <span 
            className={`inline-flex items-center gap-1 min-w-0 shrink-0 ${!employee.location && 'opacity-60'}`}
            title={employee.address || undefined}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[120px]">{employee.location || 'No Location'}</span>
          </span>
        </div>

        {/* Assigned Hardware Count Badge */}
        <div
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono font-medium text-xs shrink-0 ${
            assignedCount > 0
              ? 'bg-info-blue/15 text-info-blue border border-info-blue/30'
              : 'bg-base/60 text-secondary border border-border/60'
          }`}
          title={`${assignedCount} assigned hardware items`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>{assignedCount}</span>
        </div>
      </div>
    </div>
  );
});

export default EmployeeCard;
