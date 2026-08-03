import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import AssignmentModal from '../forms/AssignmentModal';
import { UserPlus, CornerDownLeft, Archive, Trash2, ShieldAlert, AlertTriangle } from 'lucide-react';

export default function LifecycleActions({ asset, onAssign, onReturn, onRetire, onDelete }) {
  const navigate = useNavigate();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isRetireModalOpen, setIsRetireModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Note states for confirmation modals
  const [returnNote, setReturnNote] = useState('');
  const [retireNote, setRetireNote] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  if (!asset) return null;

  const isRetired = asset.status === 'retired';

  const handleReturnConfirm = async () => {
    setSubmittingAction(true);
    try {
      await onReturn(returnNote.trim());
      setIsReturnModalOpen(false);
      setReturnNote('');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRetireConfirm = async () => {
    setSubmittingAction(true);
    try {
      await onRetire(retireNote.trim());
      setIsRetireModalOpen(false);
      setRetireNote('');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDeleteConfirm = async (e) => {
    e.preventDefault();
    if (deleteConfirmText !== asset.name) return;
    setSubmittingAction(true);
    try {
      await onDelete();
      navigate('/inventory');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border/80 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <h3 className="text-base font-semibold text-primary">Lifecycle & Operational Controls</h3>
        <span className="text-xs text-secondary font-mono">Status: {asset.status?.toUpperCase()}</span>
      </div>

      {isRetired && (
        <div className="bg-base/80 border border-warning/30 rounded-xl p-4 flex items-start gap-3 text-sm text-warning">
          <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Asset is Retired & Decommissioned</span>
            <span className="text-xs text-warning/80">
              Per engineering rules, retired hardware cannot be assigned, returned, or modified. Only view history or permanent deletion is permitted.
            </span>
          </div>
        </div>
      )}

      {asset.parentId && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-3.5 flex items-center gap-3 text-xs text-accent">
          <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
          <span>
            This item is a sub-asset linked to its parent device. Assignment and return lifecycle actions are automatically cascaded from the parent asset.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Assign / Reassign Button */}
        {!isRetired && (
          <Button
            variant="primary"
            onClick={() => setIsAssignModalOpen(true)}
            disabled={Boolean(asset.parentId)}
            title={asset.parentId ? 'Managed via parent asset' : undefined}
            className="flex-1 sm:flex-initial"
          >
            <UserPlus className="w-4 h-4" />
            <span>{asset.status === 'in-use' ? 'Reassign Asset' : 'Assign to Employee'}</span>
          </Button>
        )}

        {/* Return to Stock Button */}
        {asset.status === 'in-use' && !isRetired && (
          <Button
            variant="secondary"
            onClick={() => setIsReturnModalOpen(true)}
            disabled={Boolean(asset.parentId)}
            title={asset.parentId ? 'Managed via parent asset' : undefined}
            className="flex-1 sm:flex-initial"
          >
            <CornerDownLeft className="w-4 h-4" />
            <span>Return to Stock</span>
          </Button>
        )}

        {/* Retire Asset Button */}
        {!isRetired && (
          <Button
            variant="danger"
            onClick={() => setIsRetireModalOpen(true)}
            className="flex-1 sm:flex-initial"
          >
            <Archive className="w-4 h-4" />
            <span>Retire Asset</span>
          </Button>
        )}

        {/* Delete Asset Button (Always available to Admin) */}
        <Button
          variant="danger"
          onClick={() => setIsDeleteModalOpen(true)}
          className="flex-1 sm:flex-initial ml-auto"
          title="Permanently remove asset record"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </Button>
      </div>

      {/* 1. Assignment Modal */}
      <AssignmentModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssign={onAssign}
        asset={asset}
      />

      {/* 2. Return to Stock Confirmation Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => !submittingAction && setIsReturnModalOpen(false)}
        title="Confirm Return to Stock"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Are you sure you want to unassign <span className="font-semibold text-white">{asset.name}</span> ({asset.serialNumber}) from <span className="font-semibold text-white">{asset.assigneeName}</span> and mark it as available in inventory?
          </p>

          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
              Return Inspection Note (Optional)
            </label>
            <textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="E.g., Returned in excellent condition. Charger included."
              rows={2}
              className="w-full rounded-xl bg-base border border-border p-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsReturnModalOpen(false)} disabled={submittingAction}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleReturnConfirm} loading={submittingAction}>
              <CornerDownLeft className="w-4 h-4" />
              <span>Confirm Return</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* 3. Retire Asset Confirmation Modal */}
      <Modal
        isOpen={isRetireModalOpen}
        onClose={() => !submittingAction && setIsRetireModalOpen(false)}
        title="Confirm Decommission & Retirement"
      >
        <div className="space-y-4">
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-3.5 flex items-start gap-3 text-sm text-danger">
            <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Warning: Irreversible Status Change</span>
              <span className="text-xs text-danger/80">
                Once retired, this asset cannot be re-assigned or returned to service. It will be marked end-of-life.
              </span>
            </div>
          </div>

          <p className="text-sm text-secondary">
            Retiring asset: <span className="font-semibold text-white">{asset.name}</span> ({asset.serialNumber}).
          </p>

          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
              Reason for Retirement / Disposal Note
            </label>
            <textarea
              value={retireNote}
              onChange={(e) => setRetireNote(e.target.value)}
              placeholder="E.g., Hardware motherboard failure. E-waste recycling scheduled."
              rows={2}
              required
              className="w-full rounded-xl bg-base border border-border p-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-danger"
            />
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsRetireModalOpen(false)} disabled={submittingAction}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRetireConfirm} loading={submittingAction}>
              <Archive className="w-4 h-4" />
              <span>Confirm Retirement</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Delete Asset Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !submittingAction && setIsDeleteModalOpen(false)}
        title="Confirm Permanent Deletion"
      >
        <form onSubmit={handleDeleteConfirm} className="space-y-4">
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-3.5 flex items-start gap-3 text-sm text-danger">
            <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Destructive Action</span>
              <span className="text-xs text-danger/80">
                This will permanently delete the asset record and all associated history logs from the database.
              </span>
            </div>
          </div>

          <p className="text-sm text-secondary">
            To confirm deletion, please type <span className="font-mono font-bold text-white bg-base px-1.5 py-0.5 rounded border border-border">{asset.name}</span> exactly below:
          </p>

          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={asset.name}
            required
            className="w-full rounded-xl bg-base border border-border p-3 text-sm text-primary font-mono focus:outline-none focus:ring-2 focus:ring-danger"
          />

          <div className="pt-3 border-t border-border flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)} disabled={submittingAction}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={submittingAction}
              disabled={deleteConfirmText !== asset.name}
            >
              <Trash2 className="w-4 h-4" />
              <span>Permanently Delete</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
