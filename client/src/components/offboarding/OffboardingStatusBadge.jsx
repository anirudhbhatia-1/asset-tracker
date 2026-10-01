import React from 'react';
import { OFFBOARDING_STATUS_LABELS } from '../../utils/offboarding';

const STYLES = {
  pending: 'bg-raised text-secondary border-border',
  in_progress: 'bg-warning/10 text-warning border-warning/20',
  completed: 'bg-success text-on-accent border-success',
  cancelled: 'bg-error/10 text-error border-error/20',
};

export default function OffboardingStatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider whitespace-nowrap ${STYLES[status] || STYLES.pending}`}>
      {OFFBOARDING_STATUS_LABELS[status] || String(status || '').replace('_', ' ')}
    </span>
  );
}
