import React from 'react';
import Pill from '../ui/Pill';
import { getTicketAge } from '../../utils/ticketAge';
import { TICKET_STATUS_LABELS } from '../../utils/ticketStatus';
import { TICKET_TYPE_LABELS, priorityLabel, priorityTone, ticketStatusTone } from '../../utils/ticketMeta';

// The only ticket status/priority/type/age chips: every screen uses these.
export default function TicketStatusBadge({ status }) {
  return <Pill tone={ticketStatusTone(status)}>{TICKET_STATUS_LABELS[status] || status || 'Unknown'}</Pill>;
}

export function PriorityBadge({ priority }) {
  return <Pill tone={priorityTone(priority)} srSuffix=" priority">{priorityLabel(priority)}</Pill>;
}

export function TicketTypeBadge({ type }) {
  return <Pill>{TICKET_TYPE_LABELS[type] || type}</Pill>;
}

const AGE_TONES = { normal: 'neutral', warning: 'warning', critical: 'danger' };

// "3d old" chip for open/in-progress tickets; renders nothing otherwise.
export function TicketAgeBadge({ ticket }) {
  const age = getTicketAge(ticket);
  if (!age) return null;
  return (
    <Pill tone={AGE_TONES[age.level]} title={`Open for ${age.days} day${age.days === 1 ? '' : 's'}`}>
      {age.label}
    </Pill>
  );
}
