import React, { useState } from 'react';
import { Undo2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Textarea } from '../ui/Field';
import { returnableCount } from '../../utils/assetSelection';

/**
 * Confirms returning the selected assets (assigned ones only). Company assets
 * go back to stock; client-owned ones are marked returned to the client.
 */
export default function BulkReturnModal({ isOpen, onClose, assets = [], onReturn }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Return selected assets" maxWidth="max-w-md">
      {isOpen && <ReturnForm onClose={onClose} assets={assets} onReturn={onReturn} />}
    </Modal>
  );
}

function ReturnForm({ onClose, assets, onReturn }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const returnable = returnableCount(assets);
  const skipped = assets.length - returnable;
  const clientCount = assets.filter((asset) => asset?.status === 'in-use' && asset.assetType === 'client').length;
  const plural = returnable === 1 ? '' : 's';
  let outcome;
  if (clientCount === 0) outcome = `Return ${returnable} assigned asset${plural} to stock? They’ll be marked available and unassigned.`;
  else if (clientCount === returnable) outcome = `Return ${returnable} assigned client asset${plural}? They’ll be unassigned and marked returned to the client.`;
  else outcome = `Return ${returnable} assigned assets? Company assets go back to stock; the ${clientCount} client asset${clientCount === 1 ? ' is' : 's are'} marked returned to the client.`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onReturn(note.trim());
      onClose();
    } catch {
      // The hook showed the error toast.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2 text-sm">
        <p className="text-primary">{outcome}</p>
        {skipped > 0 && (
          <p className="text-secondary">
            {skipped} of the {assets.length} selected {skipped === 1 ? 'isn’t' : 'aren’t'} assigned to anyone and will be skipped.
          </p>
        )}
      </div>

      <Field id="bulk-return-note" label="Note (Optional)">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="E.g., Collected after the project ended."
        />
      </Field>

      <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button type="submit" loading={submitting} disabled={returnable === 0}>
          <Undo2 className="w-4 h-4" aria-hidden="true" />
          <span>Return {returnable}</span>
        </Button>
      </div>
    </form>
  );
}
