const toTime = (value) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Merges an asset's audit history with its linked tickets into one list,
 * newest first. Entries are { kind: 'history' | 'ticket', key, at, item }.
 * Ticket entries also carry relation: 'raised' (asset_id matches) or
 * 'fulfilled' (the ticket was resolved by handing this asset out).
 */
export function buildAssetTimeline(history = [], tickets = [], assetId = null) {
  const entries = [];
  (Array.isArray(history) ? history : []).forEach((event, index) => {
    entries.push({ kind: 'history', key: `history-${event.id ?? index}`, at: event.eventAt, item: event });
  });
  (Array.isArray(tickets) ? tickets : []).forEach((ticket) => {
    const raised = assetId == null || Number(ticket.asset_id) === Number(assetId);
    entries.push({
      kind: 'ticket',
      key: `ticket-${ticket.id}`,
      at: ticket.created_at,
      item: ticket,
      relation: raised ? 'raised' : 'fulfilled',
    });
  });
  // Array.prototype.sort is stable, so same-timestamp entries keep input order.
  return entries.sort((a, b) => toTime(b.at) - toTime(a.at));
}
