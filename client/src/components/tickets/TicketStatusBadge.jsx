import React from 'react';
import { getTicketAge } from '../../utils/ticketAge';

const STATUS_STYLES = {
  open: 'bg-danger/10 text-danger border-danger/20',
  in_progress: 'bg-warning/10 text-warning border-warning/20',
  resolved: 'bg-success/10 text-success border-success/20',
  closed: 'bg-success/5 text-secondary border-success/20',
  rejected: 'bg-raised text-secondary border-border',
};

export default function TicketStatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider whitespace-nowrap ${STATUS_STYLES[status] || STATUS_STYLES.rejected}`}>
      {(status || 'unknown').replace('_', ' ')}
    </span>
  );
}

const AGE_STYLES = {
  normal: 'text-secondary border-border',
  warning: 'text-warning border-warning/30 bg-warning/10',
  critical: 'text-danger border-danger/30 bg-danger/10',
};

// "3d old" chip for open/in-progress tickets; renders nothing otherwise.
export function TicketAgeBadge({ ticket }) {
  const age = getTicketAge(ticket);
  if (!age) return null;
  return (
    <span
      className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ${AGE_STYLES[age.level]}`}
      title={`Open for ${age.days} day${age.days === 1 ? '' : 's'}`}
    >
      {age.label}
    </span>
  );
}
