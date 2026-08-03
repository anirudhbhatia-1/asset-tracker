import React from 'react';
import { History, Activity } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

export default function ActivityFeed({ history = [], loading = false }) {
  const getTagStyles = (type) => {
    const norm = (type || '').toLowerCase();
    switch (norm) {
      case 'assigned':
      case 'assignment':
        return { label: 'Assignment', badgeClass: 'bg-info-blue/10 text-info-blue border-info-blue/30' };
      case 'returned':
        return { label: 'Returned', badgeClass: 'bg-warning/10 text-warning border-warning/30' };
      case 'created':
        return { label: 'Created', badgeClass: 'bg-info-purple/10 text-info-purple border-info-purple/30' };
      case 'updated':
        return { label: 'Updated', badgeClass: 'bg-accent/10 text-accent border-accent/30' };
      case 'retired':
      case 'retire':
      case 'deleted':
        return { label: norm === 'deleted' ? 'Deleted' : 'Retired', badgeClass: 'bg-danger/10 text-danger border-danger/30' };
      case 'google':
      case 'sync':
        return { label: 'Google Sync', badgeClass: 'bg-success/10 text-success border-success/30' };
      default:
        return { label: type || 'System', badgeClass: 'bg-raised text-secondary border-border' };
    }
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-border/60 shadow-sm animate-pulse h-96">
        <div className="h-6 w-36 bg-raised rounded mb-6" />
        <div className="space-y-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between gap-4">
              <div className="h-4 w-20 bg-raised rounded shrink-0" />
              <div className="h-4 w-full bg-raised rounded" />
              <div className="h-4 w-16 bg-raised rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const safeHistory = Array.isArray(history) ? history : [];

  return (
    <div className="bg-surface rounded-xl p-6 border border-border/60 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            <h3 className="text-base font-semibold text-primary">Recent Audit Activity</h3>
          </div>
          <span className="text-xs font-medium text-secondary bg-raised/50 px-2 py-0.5 rounded-full border border-border/50">
            Live Feed
          </span>
        </div>

        {safeHistory.length === 0 ? (
          <div className="text-center py-16 text-secondary text-sm flex flex-col items-center gap-2">
            <History className="w-8 h-8 text-secondary" />
            <span>No activity events recorded yet.</span>
          </div>
        ) : (
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 divide-y divide-border/40">
            {safeHistory.map((event) => {
              const { label, badgeClass } = getTagStyles(event.eventType);
              let formattedTime = '';
              try {
                if (event.eventAt) {
                  formattedTime = formatDateTime(event.eventAt);
                }
              } catch (e) {
                formattedTime = event.eventAt;
              }

              return (
                <div key={event.id} className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 text-sm">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border shrink-0 uppercase tracking-wider mt-0.5 ${badgeClass}`}>
                      {label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-primary font-medium break-words">
                        {event.assetName || event.assetSerialNumber ? (
                          <span className="text-accent font-semibold">{event.assetName || event.assetSerialNumber}</span>
                        ) : null}
                        {event.assetName || event.assetSerialNumber ? ' — ' : ''}
                        <span>{event.note || `Performed ${event.eventType} action`}</span>
                      </p>
                      <p className="text-xs text-secondary mt-0.5">
                        By <span className="text-secondary">{event.performedBy || 'System'}</span>
                        {event.employeeName && <span> → to <span className="text-secondary font-medium">{event.employeeName}</span></span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-secondary font-mono shrink-0 pt-0.5 self-end sm:self-auto">{formattedTime || 'N/A'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-border/50 flex justify-between items-center text-xs text-secondary">
        <span>Showing latest {safeHistory.length} events</span>
        <span className="text-secondary font-mono">Immutable Log ✓</span>
      </div>
    </div>
  );
}
