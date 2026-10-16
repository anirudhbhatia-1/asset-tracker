import React, { useId } from 'react';
import { UserPlus, Undo2, MapPin, Download, QrCode, X, AlertTriangle, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import { BULK_SELECTION_LIMIT, assignBlocker, returnableCount } from '../../utils/assetSelection';


/**
 * Actions for the selected assets. Sticks to the bottom of the screen while
 * the list scrolls (above the tab bar on phones). Each action shows only
 * with its permission; ones that can't run on this selection are disabled
 * with the reason written out.
 */
export default function BulkActionBar({
  selectedAssets,
  permissions,
  exporting = false,
  onAssign,
  onReturn,
  onEdit,
  onExport,
  onPrint,
  onClear,
}) {
  const reasonsId = useId();
  const count = selectedAssets.length;
  if (count === 0) return null;

  const overLimit = count > BULK_SELECTION_LIMIT;
  const blocker = assignBlocker(selectedAssets);
  const returnable = returnableCount(selectedAssets);
  // Why actions are disabled: written out below the buttons, and each
  // disabled button points at its reason via aria-describedby.
  const overLimitId = `${reasonsId}-over-limit`;
  const blockerId = `${reasonsId}-assign-blocker`;
  const returnReasonId = `${reasonsId}-return-reason`;
  const noReturnable = !overLimit && returnable === 0;
  const notes = [];
  if (overLimit) notes.push({ id: overLimitId, tone: 'warning', text: `Bulk actions handle up to ${BULK_SELECTION_LIMIT} assets at a time. Narrow the selection to continue.` });
  else if (permissions.assign && blocker && count > 0) notes.push({ id: blockerId, tone: 'muted', text: blocker });
  if (permissions.assign && noReturnable) notes.push({ id: returnReasonId, tone: 'muted', text: 'None of the selected assets are assigned, so there is nothing to return.' });
  const describedBy = (disabled, reasonId) => (disabled ? (overLimit ? overLimitId : reasonId) : undefined);

  return (
    <div className="sticky z-20 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] md:bottom-4 animate-fadeIn">
      <div
        role="toolbar"
        aria-label="Actions for selected assets"
        className="bg-surface/95 backdrop-blur-xl border border-accent/30 rounded-xl shadow-xl shadow-black/10 p-2 sm:p-2.5 space-y-2"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <p className="pl-1.5 text-sm font-semibold text-primary whitespace-nowrap" aria-live="polite">
            {count} selected
          </p>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Clear<span className="sr-only"> selection</span>
          </Button>

          {/* Actions scroll sideways on narrow screens rather than wrapping. */}
          <div className="basis-full sm:basis-0 sm:flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none sm:justify-end">
            {permissions.assign && (
              <Button
                size="sm"
                onClick={onAssign}
                disabled={overLimit || Boolean(blocker)}
                aria-describedby={describedBy(overLimit || Boolean(blocker), blocker ? blockerId : undefined)}
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                Assign to…
              </Button>
            )}
            {permissions.assign && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onReturn}
                disabled={overLimit || returnable === 0}
                aria-describedby={describedBy(overLimit || returnable === 0, noReturnable ? returnReasonId : undefined)}
              >
                <Undo2 className="w-4 h-4" aria-hidden="true" />
                Return
              </Button>
            )}
            {permissions.update && (
              <Button variant="secondary" size="sm" onClick={onEdit} disabled={overLimit} aria-describedby={describedBy(overLimit)}>
                <MapPin className="w-4 h-4" aria-hidden="true" />
                Location / category
              </Button>
            )}
            {permissions.export && (
              <Button variant="secondary" size="sm" onClick={onExport} disabled={overLimit || exporting} aria-describedby={describedBy(overLimit)}>
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
                Export
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onPrint} disabled={overLimit} aria-describedby={describedBy(overLimit)}>
              <QrCode className="w-4 h-4" aria-hidden="true" />
              QR labels
            </Button>
          </div>
        </div>

        {notes.map((note) => (
          <p
            key={note.text}
            id={note.id}
            className={`flex items-start gap-1.5 px-1.5 text-xs ${note.tone === 'warning' ? 'text-warning' : 'text-secondary'}`}
          >
            {note.tone === 'warning' && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />}
            {note.text}
          </p>
        ))}
      </div>
    </div>
  );
}
