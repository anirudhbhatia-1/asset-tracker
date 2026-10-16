import React from 'react';
import { CheckCircle2, Clock, Archive, Undo2, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react';
import Pill from './Pill';

// Asset and warranty statuses: label, tone and icon for each.
const STATUSES = {
  available: { label: 'Available', tone: 'success', icon: CheckCircle2 },
  'in-use': { label: 'In Use', tone: 'info', icon: Clock },
  retired: { label: 'Retired', tone: 'neutral', icon: Archive },
  returned: { label: 'Returned to Client', tone: 'accent', icon: Undo2 },
  'in warranty': { label: 'In Warranty', tone: 'success', icon: ShieldCheck },
  'expiring soon': { label: 'Expiring Soon', tone: 'warning', icon: ShieldAlert },
  expired: { label: 'Expired', tone: 'danger', icon: ShieldX },
  'no warranty data': { label: 'No Warranty Data', tone: 'neutral', icon: ShieldQuestion },
};

export default function StatusPill({ status }) {
  const known = STATUSES[(status || '').toLowerCase()];
  if (!known) return <Pill size="md">{status || 'Unknown'}</Pill>;
  return <Pill size="md" tone={known.tone} icon={known.icon}>{known.label}</Pill>;
}
