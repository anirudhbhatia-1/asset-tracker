import React from 'react';
import { CheckCircle2, Clock, Archive } from 'lucide-react';

export default function StatusPill({ status }) {
  const normalizedStatus = (status || '').toLowerCase();

  if (normalizedStatus === 'available') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Available</span>
      </span>
    );
  }

  if (normalizedStatus === 'in-use') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 border border-blue-500/30 text-blue-400">
        <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" />
        </span>
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>In Use</span>
      </span>
    );
  }

  if (normalizedStatus === 'retired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 border border-slate-500/30 text-slate-400">
        <Archive className="w-3.5 h-3.5 shrink-0" />
        <span>Retired</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600">
      <span>{status || 'Unknown'}</span>
    </span>
  );
}
