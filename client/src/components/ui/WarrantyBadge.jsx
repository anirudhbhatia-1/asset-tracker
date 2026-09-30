import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react';
import { getWarrantyBadge } from '../../utils/formatters';

const TONES = {
  danger: { className: 'bg-danger/10 border-danger/30 text-danger', Icon: ShieldX },
  warning: { className: 'bg-warning/10 border-warning/30 text-warning', Icon: ShieldAlert },
  success: { className: 'bg-success/10 border-success/30 text-success', Icon: ShieldCheck },
  muted: { className: 'border-transparent text-secondary', Icon: ShieldQuestion },
};

// Compact warranty countdown for list/grid views ("Expired", "12d left").
export default function WarrantyBadge({ expiryDate }) {
  const { label, tone, title } = getWarrantyBadge(expiryDate);
  const { className, Icon } = TONES[tone] || TONES.muted;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${className}`}
      title={title}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
