import React, { useState } from 'react';
import { Undo2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { returnableCount } from '../../utils/assetSelection';

/** Confirms returning the selected assets to stock (assigned ones only). */
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
        <p className="text-primary">
          Return <strong>{returnable}</strong> assigned asset{returnable === 1 ? '' : 's'} to stock? They’ll be marked available and unassigned.
        </p>
        {skipped > 0 && (
          <p className="text-secondary">
            {skipped} of the {assets.length} selected {skipped === 1 ? 'isn’t' : 'aren’t'} assigned to anyone and will be skipped.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="bulk-return-note" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
          Note (Optional)
        </label>
        <textarea
          id="bulk-return-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="E.g., Collected after the project ended."
          className="w-full rounded-xl bg-base border border-border p-3 text-base sm:text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

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
