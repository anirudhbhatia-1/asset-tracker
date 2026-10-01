import React, { useState, useId } from 'react';
import { Package, CheckCircle2, AlertTriangle, Loader2, CornerDownRight } from 'lucide-react';
import { groupChecklistItems } from '../../utils/offboarding';
import { formatDateTime } from '../../utils/formatters';

const controlClass = 'w-full px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

const ClientTag = () => (
  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
    Client
  </span>
);

const ResolvedOutcome = ({ item }) => {
  const isClient = item.assetType === 'client';
  const returned = item.status === 'returned';
  return (
    <div className="space-y-1 sm:text-right">
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        {returned ? (
          <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-1 rounded-md border border-success/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isClient ? 'Returned to client' : 'Returned'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-error bg-error/10 px-2 py-1 rounded-md border border-error/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Missing
          </span>
        )}
        {returned && item.condition && (
          <span className={`text-xs px-2 py-1 rounded-md border ${item.condition === 'damaged' ? 'text-warning bg-warning/10 border-warning/20' : 'text-secondary bg-raised border-border'}`}>
            {item.condition === 'damaged' ? 'Damaged' : 'Good condition'}
          </span>
        )}
      </div>
      {item.notes && <div className="text-xs text-primary break-words">{item.notes}</div>}
      {(item.resolvedByName || item.resolvedAt) && (
        <div className="text-[11px] text-secondary">
          {item.resolvedByName ? `By ${item.resolvedByName}` : ''}
          {item.resolvedByName && item.resolvedAt ? ' · ' : ''}
          {item.resolvedAt ? formatDateTime(item.resolvedAt) : ''}
        </div>
      )}
    </div>
  );
};

const ReturnForm = ({ item, busy, onConfirm, onCancel }) => {
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');
  const id = useId();
  const isClient = item.assetType === 'client';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onConfirm({ condition, notes: notes.trim() || undefined }); }}
      className="w-full sm:w-72 space-y-2 p-3 bg-surface rounded-lg border border-border"
    >
      <fieldset>
        <legend className="text-xs font-medium text-primary mb-1.5">Condition</legend>
        <div className="flex gap-4">
          {[['good', 'Good'], ['damaged', 'Damaged']].map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 text-xs text-primary cursor-pointer">
              <input
                type="radio"
                name={`${id}-condition`}
                value={value}
                checked={condition === value}
                onChange={() => setCondition(value)}
                className="text-accent focus:ring-accent"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${id}-notes`} className="block text-xs font-medium text-primary mb-1">Note (optional)</label>
        <input
          id={`${id}-notes`}
          type="text"
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={condition === 'damaged' ? 'What is damaged?' : 'e.g. collected at front desk'}
          className={controlClass}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={busy} className="px-2 py-1.5 text-secondary hover:text-primary text-xs font-medium">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/90 text-on-accent text-xs font-medium rounded-md disabled:opacity-50 transition-colors"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isClient ? 'Confirm returned to client' : 'Confirm returned'}
        </button>
      </div>
    </form>
  );
};

/**
 * The asset checklist of an offboarding request. Accessories are nested
 * under the asset they are attached to. With `canCollect`, pending items get
 * "Returned" (inline condition + note) and "Missing" (`onRequestMissing`,
 * which the parent confirms) actions.
 */
export default function OffboardingChecklist({ items, canCollect = false, canReturn = true, canWriteOff = true, busyItemId = null, onReturn, onRequestMissing }) {
  const [returningItemId, setReturningItemId] = useState(null);
  const groups = groupChecklistItems(items);

  if (groups.length === 0) {
    return <p className="text-sm text-secondary italic">This employee holds no assets. Nothing to collect.</p>;
  }

  const handleConfirmReturn = async (item, data) => {
    try {
      await onReturn(item, data);
      setReturningItemId(null);
    } catch {
      // The hook already showed the server's message; keep the form open.
    }
  };

  const renderItem = (item, parent) => {
    const pending = item.status === 'pending';
    const busy = busyItemId === item.id;
    const isClient = item.assetType === 'client';
    const subtitle = [item.serialNumber, item.categoryName].filter(Boolean).join(' · ');

    return (
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start justify-between">
        <div className="min-w-0">
          <div className="font-medium text-primary flex flex-wrap items-center gap-2">
            {parent
              ? <CornerDownRight className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
              : <Package className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />}
            <span className="break-words">{item.assetName || `Asset #${item.assetId}`}</span>
            {isClient && <ClientTag />}
          </div>
          {subtitle && <div className="text-xs text-secondary mt-1 ml-6 break-all">{subtitle}</div>}
          {parent && pending && (
            <div className="text-xs text-secondary mt-1 ml-6 italic">
              Returns with {parent.assetName || `asset #${parent.assetId}`}
            </div>
          )}
        </div>

        <div className="w-full sm:w-auto shrink-0">
          {!pending ? (
            <ResolvedOutcome item={item} />
          ) : canCollect && (canReturn || canWriteOff) ? (
            returningItemId === item.id ? (
              <ReturnForm
                item={item}
                busy={busy}
                onConfirm={(data) => handleConfirmReturn(item, data)}
                onCancel={() => setReturningItemId(null)}
              />
            ) : (
              <div className="flex items-center gap-2">
                {canReturn && <button
                  type="button"
                  onClick={() => setReturningItemId(item.id)}
                  disabled={busyItemId != null}
                  aria-label={`Mark ${item.assetName || 'asset'} returned`}
                  className="flex-1 sm:flex-none px-3 py-1.5 border border-accent text-accent hover:bg-accent/5 text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                >
                  Returned
                </button>}
                {canWriteOff && <button
                  type="button"
                  onClick={() => onRequestMissing(item)}
                  disabled={busyItemId != null}
                  aria-label={`Report ${item.assetName || 'asset'} missing`}
                  className="flex-1 sm:flex-none px-3 py-1.5 border border-border text-error hover:bg-error/10 text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Missing'}
                </button>}
              </div>
            )
          ) : (
            <div className="text-xs text-warning bg-warning/10 px-2 py-1 rounded-md border border-warning/20 w-max">Pending return</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <ul className="space-y-3" aria-label="Asset checklist">
      {groups.map(({ item, children }) => (
        <li key={item.id} className="p-4 bg-base rounded-lg border border-border">
          {renderItem(item, null)}
          {children.length > 0 && (
            <ul className="mt-3 ml-2 sm:ml-6 pl-3 border-l-2 border-border space-y-3" aria-label={`Accessories of ${item.assetName || 'asset'}`}>
              {children.map(child => (
                <li key={child.item.id}>{renderItem(child.item, child.parent)}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
