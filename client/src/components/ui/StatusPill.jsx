import React from 'react';
import { CheckCircle2, Clock, Archive, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react';

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

  // Warranty Statuses
  if (normalizedStatus === 'in warranty') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 border border-success/30 text-success">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>In Warranty</span>
      </span>
    );
  }

  if (normalizedStatus === 'expiring soon') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 border border-warning/30 text-warning">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
        <span>Expiring Soon</span>
      </span>
    );
  }

  if (normalizedStatus === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger/10 border border-danger/30 text-danger">
        <ShieldX className="w-3.5 h-3.5 shrink-0" />
        <span>Expired</span>
      </span>
    );
  }

  if (normalizedStatus === 'no warranty data') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/10 border border-secondary/30 text-secondary">
        <ShieldQuestion className="w-3.5 h-3.5 shrink-0" />
        <span>No Warranty Data</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-raised/50 text-secondary border border-border">
      <span>{status || 'Unknown'}</span>
    </span>
  );
}
