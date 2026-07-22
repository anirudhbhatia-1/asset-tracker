import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { History, CheckCircle2, UserPlus, CornerDownLeft, Archive, Edit3, Trash2 } from 'lucide-react';

export default function HistoryTimeline({ history = [], loading = false }) {
  const getEventMeta = (type) => {
    const norm = (type || '').toLowerCase();
    switch (norm) {
      case 'created':
        return {
          title: 'Asset Registered',
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          dotColor: 'bg-purple-500',
          Icon: CheckCircle2,
        };
      case 'assigned':
        return {
          title: 'Assigned to Employee',
          color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          dotColor: 'bg-blue-500',
          Icon: UserPlus,
        };
      case 'returned':
        return {
          title: 'Returned to Stock',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dotColor: 'bg-amber-500',
          Icon: CornerDownLeft,
        };
      case 'retired':
        return {
          title: 'Decommissioned & Retired',
          color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          dotColor: 'bg-rose-500',
          Icon: Archive,
        };
      case 'deleted':
        return {
          title: 'Permanently Deleted',
          color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          dotColor: 'bg-rose-500',
          Icon: Trash2,
        };
      default:
        return {
          title: 'Metadata Updated',
          color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
          dotColor: 'bg-indigo-500',
          Icon: Edit3,
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/80 shadow-sm animate-pulse space-y-6">
        <div className="h-6 w-48 bg-slate-700 rounded" />
        <div className="space-y-6 pl-4 border-l-2 border-slate-700">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-slate-700 rounded" />
              <div className="h-4 w-full bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/80 shadow-sm">
      <div className="flex items-center justify-between mb-6 border-b border-slate-700/60 pb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-semibold text-slate-100">Audit History Timeline</h3>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {history.length} {history.length === 1 ? 'Event' : 'Events'}
        </span>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No audit history events recorded for this asset.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
          {history.map((event) => {
            const { title, color, dotColor, Icon } = getEventMeta(event.eventType);
            let relativeTime = event.eventAt;
            try {
              if (event.eventAt) {
                const dateStr = event.eventAt.includes('T') ? event.eventAt : event.eventAt.replace(' ', 'T') + 'Z';
                relativeTime = formatDistanceToNow(new Date(dateStr), { addSuffix: true });
              }
            } catch (e) {
              relativeTime = event.eventAt;
            }

            return (
              <div key={event.id} className="relative group">
                {/* Timeline Dot with Icon */}
                <span className={`absolute -left-[23px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-800 shadow ${dotColor}`}>
                  <Icon className="w-3 h-3 text-white stroke-[2.5]" />
                </span>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 space-y-1.5 group-hover:border-slate-600 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${color}`}>
                        {title}
                      </span>
                      {event.employeeName && (
                        <span className="text-xs text-slate-300 font-medium">
                          → {event.employeeName}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-400" title={event.eventAt}>
                      {relativeTime}
                    </span>
                  </div>

                  <p className="text-sm text-slate-200 font-medium pt-1">
                    {event.note || `Performed ${event.eventType} operation`}
                  </p>

                  <p className="text-xs text-slate-400">
                    Performed by <span className="text-slate-300 font-medium">{event.performedBy || 'System'}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
