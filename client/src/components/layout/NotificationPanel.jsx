import React, { useRef, useEffect } from 'react';
import { Bell, X, CheckCircle2, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../utils/formatters';

const iconMap = {
  success: <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />,
  warning: <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />,
  info:    <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />,
};

export default function NotificationPanel({ isOpen, onClose, notifications, loading }) {
  const panelRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface border border-border/80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-base/50">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-primary">Notifications</span>
          {notifications.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-accent text-white text-[10px] font-bold leading-none">
              {notifications.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-raised/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[400px] overflow-y-auto divide-y divide-border/40">
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-4 h-4 rounded-full bg-raised mt-1 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-raised rounded w-3/4" />
                  <div className="h-2.5 bg-raised rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="w-8 h-8 text-secondary/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-secondary">You're all caught up!</p>
            <p className="text-xs text-secondary/60 mt-1">No new notifications right now.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (n.link) navigate(n.link);
                onClose();
              }}
              className="w-full text-left px-4 py-3.5 hover:bg-raised/40 transition-colors flex gap-3 group"
            >
              {iconMap[n.type] || iconMap.info}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-primary leading-tight">{n.title}</span>
                  <ExternalLink className="w-3 h-3 text-secondary opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
                </div>
                <p className="text-xs text-secondary mt-0.5 leading-relaxed">{n.message}</p>
                <span className="text-[10px] text-secondary/50 mt-1 block">
                  {formatDateTime(n.createdAt)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-border/60 bg-base/30">
          <p className="text-[10px] text-secondary/50 text-center">
            Showing last 7 days · Refreshes every 30s
          </p>
        </div>
      )}
    </div>
  );
}
