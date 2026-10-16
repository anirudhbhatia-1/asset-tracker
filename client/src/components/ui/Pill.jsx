import React from 'react';

// One look for every small status/label chip in the app. Pick a tone by
// meaning, not colour: danger is for things that need action now (urgent,
// overdue, expired), so it keeps standing out.
const PILL_TONES = {
  neutral: 'bg-raised text-secondary border-border',
  accent: 'bg-accent/10 text-accent border-accent/25',
  info: 'bg-info-blue/10 text-info-blue border-info-blue/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  purple: 'bg-info-purple/10 text-info-purple border-info-purple/30',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

/**
 * <Pill tone="info" icon={Clock}>In use</Pill>
 * - `srSuffix` adds words for screen readers only (e.g. " priority").
 */
export default function Pill({ tone = 'neutral', size = 'sm', icon: Icon, title, srSuffix, className = '', children }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${SIZES[size] || SIZES.sm} ${PILL_TONES[tone] || PILL_TONES.neutral} ${className}`}
    >
      {Icon && <Icon className={`${size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} shrink-0`} aria-hidden="true" />}
      <span>{children}</span>
      {srSuffix && <span className="sr-only">{srSuffix}</span>}
    </span>
  );
}
