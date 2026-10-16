import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { ticketRef } from '../../utils/ticketMeta';

// Asks why a resolved ticket is being reopened. The reason is optional on
// the API, so Reopen stays enabled with an empty note.
export default function ReopenTicketModal({ ticket, onClose, onReopen }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ticket) setNote('');
  }, [ticket]);

  const handleClose = () => {
    if (!submitting) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onReopen(ticket.id, note.trim());
      onClose();
    } catch {
      // The tickets hook already shows a toast; keep the modal open to retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={!!ticket}
      onClose={handleClose}
      title={`Reopen ${ticketRef(ticket)}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reopen-note" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
            Why are you reopening this ticket?
          </label>
          <textarea
            id="reopen-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="E.g., The issue came back after a restart."
            autoFocus
            className="w-full px-3 py-2 bg-base border border-border rounded-lg text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={submitting}>
            Reopen
          </Button>
        </div>
      </form>
    </Modal>
  );
}
