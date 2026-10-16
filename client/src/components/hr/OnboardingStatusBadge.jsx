import React from 'react';
import Pill from '../ui/Pill';
import { ONBOARDING_STATUS_LABELS } from '../../utils/onboardingStatus';

// Onboarding request status chip (HR dashboard, Onboarding list, details modal).
const TONES = {
  pending: 'neutral',
  in_progress: 'warning',
  arranged: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

export default function OnboardingStatusBadge({ status }) {
  return (
    <Pill tone={TONES[status] || 'neutral'} className="uppercase tracking-wider">
      {ONBOARDING_STATUS_LABELS[status] || String(status || '').replace('_', ' ')}
    </Pill>
  );
}
