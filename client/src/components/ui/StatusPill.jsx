import React from 'react';
import { CheckCircle2, Clock, Archive } from 'lucide-react';

export default function StatusPill({ status }) {
  const normalizedStatus = (status || '').toLowerCase();

  if (normalizedStatus === 'available') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 border border-success/30 text-success">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Available</span>
      </span>
    );
  }

  if (normalizedStatus === 'in-use') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-info-blue/10 border border-info-blue/30 text-info-blue">
        <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-info-blue opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-info-blue" />
        </span>
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>In Use</span>
      </span>
    );
  }

  if (normalizedStatus === 'retired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/10 border border-secondary/30 text-secondary">
        <Archive className="w-3.5 h-3.5 shrink-0" />
        <span>Retired</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-raised/50 text-secondary border border-border">
      <span>{status || 'Unknown'}</span>
    </span>
  );
}
