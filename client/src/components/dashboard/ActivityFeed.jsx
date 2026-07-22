import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { History, Activity } from 'lucide-react';

export default function ActivityFeed({ history = [], loading = false }) {
  const getTagStyles = (type) => {
    const norm = (type || '').toLowerCase();
    switch (norm) {
      case 'assigned':
      case 'assignment':
        return { label: 'Assignment', badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'returned':
        return { label: 'Returned', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'created':
        return { label: 'Created', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      case 'updated':
        return { label: 'Updated', badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
      case 'retired':
      case 'retire':
      case 'deleted':
        return { label: norm === 'deleted' ? 'Deleted' : 'Retired', badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      case 'google':
      case 'sync':
        return { label: 'Google Sync', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      default:
        return { label: type || 'System', badgeClass: 'bg-slate-700 text-slate-300 border-slate-600' };
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/60 shadow-sm animate-pulse h-96">
        <div className="h-6 w-36 bg-slate-700 rounded mb-6" />
        <div className="space-y-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between gap-4">
              <div className="h-4 w-20 bg-slate-700 rounded shrink-0" />
              <div className="h-4 w-full bg-slate-700 rounded" />
              <div className="h-4 w-16 bg-slate-700 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/60 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-slate-100">Recent Audit Activity</h3>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full border border-slate-600/50">
            Live Feed
          </span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm flex flex-col items-center gap-2">
            <History className="w-8 h-8 text-slate-600" />
            <span>No activity events recorded yet.</span>
          </div>
        ) : (
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 divide-y divide-slate-700/40">
            {history.map((event) => {
              const { label, badgeClass } = getTagStyles(event.eventType);
              let relativeTime = '';
              try {
                if (event.eventAt) {
                  // SQLite returns string like 'YYYY-MM-DD HH:MM:SS', parse safely
                  const dateStr = event.eventAt.includes('T') ? event.eventAt : event.eventAt.replace(' ', 'T') + 'Z';
                  relativeTime = formatDistanceToNow(new Date(dateStr), { addSuffix: true });
                }
              } catch (e) {
                relativeTime = event.eventAt;
              }

              return (
                <div key={event.id} className="pt-3.5 first:pt-0 flex items-start justify-between gap-4 text-sm">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border shrink-0 uppercase tracking-wider mt-0.5 ${badgeClass}`}>
                      {label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-slate-200 font-medium truncate">
                        {event.assetName || event.assetSerialNumber ? (
                          <span className="text-indigo-300 font-semibold">{event.assetName || event.assetSerialNumber}</span>
                        ) : null}
                        {event.assetName || event.assetSerialNumber ? ' — ' : ''}
                        <span>{event.note || `Performed ${event.eventType} action`}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        By <span className="text-slate-300">{event.performedBy || 'System'}</span>
                        {event.employeeName && <span> → to <span className="text-slate-300 font-medium">{event.employeeName}</span></span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-mono shrink-0 pt-0.5">{relativeTime || 'Just now'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-400">
        <span>Showing latest {history.length} events</span>
        <span className="text-slate-400 font-mono">Immutable Log ✓</span>
      </div>
    </div>
  );
}
