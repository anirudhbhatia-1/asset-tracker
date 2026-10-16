import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/formatters';
import { buildAssetTimeline } from '../../utils/assetTimeline';
import TicketStatusBadge from '../tickets/TicketStatusBadge';
import { History, CheckCircle2, UserPlus, CornerDownLeft, Archive, Trash2, Ticket as TicketIcon, ChevronRight } from 'lucide-react';
import { ticketRef } from '../../utils/ticketMeta';
import Pill from '../ui/Pill';
import Card, { CardHeader, CardBody } from '../ui/Card';
import EmptyState from '../ui/EmptyState';

const safeDateTime = (value) => {
  if (!value) return value;
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
};

// Ticket entries sit in the same timeline as audit events but use their own
// card so they read as "someone asked for something" rather than a state change.
function TicketEntry({ ticket, relation, linkable }) {
  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Pill tone="accent" className="font-mono">
            {ticketRef(ticket)}
          </Pill>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <span className="text-xs font-mono text-secondary" title={ticket.created_at}>
          {safeDateTime(ticket.created_at)}
        </span>
      </div>

      <p className="text-sm text-primary font-medium pt-1 flex items-center gap-1">
        <span className="truncate">{ticket.title}</span>
        {linkable && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-secondary group-hover:text-accent" />}
      </p>

      <p className="text-xs text-secondary">
        <span className="capitalize">{ticket.type || 'Ticket'}</span>
        {relation === 'fulfilled' ? ' fulfilled with this asset' : ' raised'}
        {' by '}
        <span className="text-secondary font-medium">{ticket.employee_name || 'Unknown employee'}</span>
      </p>
    </>
  );

  const cardClass = 'block bg-accent/5 p-4 rounded-xl border border-dashed border-accent/30 space-y-1.5 transition-colors';
  return linkable ? (
    <Link to={`/tickets?ticket=${ticket.id}`} className={`${cardClass} hover:border-accent/60`}>
      {body}
    </Link>
  ) : (
    <div className={cardClass}>{body}</div>
  );
}

export default function HistoryTimeline({ history = [], tickets = [], assetId = null, canOpenTickets = false, loading = false }) {
  const getEventMeta = (type) => {
    const norm = (type || '').toLowerCase();
    switch (norm) {
      case 'created':
        return {
          title: 'Asset Registered',
          tone: 'purple',
          dotColor: 'bg-info-purple',
          Icon: CheckCircle2,
        };
      case 'assigned':
        return {
          title: 'Assigned to Employee',
          tone: 'info',
          dotColor: 'bg-info-blue',
          Icon: UserPlus,
        };
      case 'returned':
        return {
          title: 'Returned to Stock',
          tone: 'warning',
          dotColor: 'bg-warning',
          Icon: CornerDownLeft,
        };
      case 'retired':
        return {
          title: 'Decommissioned & Retired',
          tone: 'neutral',
          dotColor: 'bg-secondary',
          Icon: Archive,
        };
      case 'deleted':
        return {
          title: 'Permanently Deleted',
          tone: 'neutral',
          dotColor: 'bg-secondary',
          Icon: Trash2,
        };
      default:
        return {
          title: type || 'System Event',
          tone: 'neutral',
          dotColor: 'bg-secondary',
          Icon: History,
        };
    }
  };

  const entries = useMemo(() => buildAssetTimeline(history, tickets, assetId), [history, tickets, assetId]);
  const ticketCount = entries.length - (Array.isArray(history) ? history.length : 0);

  if (loading) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-border/60 shadow-sm animate-pulse space-y-6">
        <div className="h-5 w-40 bg-raised rounded" />
        <div className="space-y-6 pl-6 border-l-2 border-border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-raised rounded" />
              <div className="h-16 w-full bg-raised rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        icon={History}
        level={3}
        title="Audit History Timeline"
        actions={(
          <span className="text-xs font-mono text-secondary">
            {entries.length} {entries.length === 1 ? 'Event' : 'Events'}
            {ticketCount > 0 && ` · ${ticketCount} ${ticketCount === 1 ? 'Ticket' : 'Tickets'}`}
          </span>
        )}
      />
      <CardBody>
      {entries.length === 0 ? (
        <EmptyState
          size="sm"
          icon={History}
          title="No audit history events recorded for this asset."
          description=""
        />
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-raised">
          {entries.map((entry) => {
            if (entry.kind === 'ticket') {
              return (
                <div key={entry.key} className="relative group">
                  <span className="absolute -left-[23px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-border shadow bg-accent">
                    <TicketIcon className="w-3 h-3 text-on-accent stroke-[2.5]" />
                  </span>
                  <TicketEntry ticket={entry.item} relation={entry.relation} linkable={canOpenTickets} />
                </div>
              );
            }

            const event = entry.item;
            const { title, tone, dotColor, Icon } = getEventMeta(event.eventType);
            const formattedTime = safeDateTime(event.eventAt);

            return (
              <div key={entry.key} className="relative group">
                {/* Timeline Dot with Icon */}
                <span className={`absolute -left-[23px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-border shadow ${dotColor}`}>
                  <Icon className="w-3 h-3 text-on-accent stroke-[2.5]" />
                </span>

                <div className="bg-base/60 p-4 rounded-xl border border-border/60 space-y-1.5 group-hover:border-border transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Pill tone={tone}>
                        {title}
                      </Pill>
                      {event.employeeName && (
                        <span className="text-xs text-secondary font-medium">
                          → {event.employeeName}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-secondary" title={event.eventAt}>
                      {formattedTime}
                    </span>
                  </div>

                  <p className="text-sm text-primary font-medium pt-1">
                    {event.note || `Performed ${event.eventType} operation`}
                  </p>

                  <p className="text-xs text-secondary">
                    Performed by <span className="text-secondary font-medium">{event.performedBy || 'System'}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </CardBody>
    </Card>
  );
}
