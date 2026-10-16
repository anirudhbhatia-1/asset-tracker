import React, { useState, useId } from 'react';
import { Package, CheckCircle2, AlertTriangle, CornerDownRight } from 'lucide-react';
import { groupChecklistItems } from '../../utils/offboarding';
import { formatDateTime } from '../../utils/formatters';
import Button from '../ui/Button';
import Pill from '../ui/Pill';
import Field, { Input } from '../ui/Field';

const ClientTag = () => (
  <Pill tone="accent" className="uppercase tracking-wider">Client</Pill>
);

const ResolvedOutcome = ({ item }) => {
  const isClient = item.assetType === 'client';
  const returned = item.status === 'returned';
  return (
    <div className="space-y-1 sm:text-right">
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        {returned ? (
          <Pill tone="success" size="md" icon={CheckCircle2}>
            {isClient ? 'Returned to client' : 'Returned'}
          </Pill>
        ) : (
          <Pill tone="danger" size="md" icon={AlertTriangle}>
            Missing
          </Pill>
        )}
        {returned && item.condition && (
          <Pill tone={item.condition === 'damaged' ? 'warning' : 'neutral'} size="md">
            {item.condition === 'damaged' ? 'Damaged' : 'Good condition'}
          </Pill>
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
      <Field id={`${id}-notes`} label="Note (optional)">
        <Input
          type="text"
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={condition === 'damaged' ? 'What is damaged?' : 'e.g. collected at front desk'}
        />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={busy}>
          {isClient ? 'Confirm returned to client' : 'Confirm returned'}
        </Button>
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
                {canReturn && <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setReturningItemId(item.id)}
                  disabled={busyItemId != null}
                  aria-label={`Mark ${item.assetName || 'asset'} returned`}
                  className="flex-1 sm:flex-none"
                >
                  Returned
                </Button>}
                {/* Client-owned assets are settled with the client, never written off. */}
                {canWriteOff && !isClient && <Button
                  variant="danger-outline"
                  size="sm"
                  onClick={() => onRequestMissing(item)}
                  disabled={busyItemId != null}
                  loading={busy}
                  aria-label={`Report ${item.assetName || 'asset'} missing`}
                  className="flex-1 sm:flex-none"
                >
                  Missing
                </Button>}
              </div>
            )
          ) : (
            <Pill tone="warning">Pending return</Pill>
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
