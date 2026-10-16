import React from 'react';
import Pill from '../ui/Pill';
import { OFFBOARDING_STATUS_LABELS } from '../../utils/offboarding';

const TONES = {
  pending: 'neutral',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

export default function OffboardingStatusBadge({ status }) {
  return (
    <Pill tone={TONES[status] || 'neutral'} className="uppercase tracking-wider">
      {OFFBOARDING_STATUS_LABELS[status] || String(status || '').replace('_', ' ')}
    </Pill>
  );
}
