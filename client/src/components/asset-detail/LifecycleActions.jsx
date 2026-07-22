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
    <div className="bg-slate-800 rounded-xl border border-slate-700/80 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
        <h3 className="text-base font-semibold text-slate-100">Lifecycle & Operational Controls</h3>
        <span className="text-xs text-slate-400 font-mono">Status: {asset.status?.toUpperCase()}</span>
      </div>

      {isRetired && (
        <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-300">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Asset is Retired & Decommissioned</span>
            <span className="text-xs text-amber-200/80">
              Per engineering rules, retired hardware cannot be assigned, returned, or modified. Only view history or permanent deletion is permitted.
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Assign / Reassign Button */}
        {!isRetired && (
          <Button
            variant="primary"
            onClick={() => setIsAssignModalOpen(true)}
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
          <p className="text-sm text-slate-300">
            Are you sure you want to unassign <span className="font-semibold text-white">{asset.name}</span> ({asset.serialNumber}) from <span className="font-semibold text-white">{asset.assigneeName}</span> and mark it as available in inventory?
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Return Inspection Note (Optional)
            </label>
            <textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="E.g., Returned in excellent condition. Charger included."
              rows={2}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-700 flex justify-end gap-3">
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
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-3 text-sm text-rose-300">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Warning: Irreversible Status Change</span>
              <span className="text-xs text-rose-200/80">
                Once retired, this asset cannot be re-assigned or returned to service. It will be marked end-of-life.
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-300">
            Retiring asset: <span className="font-semibold text-white">{asset.name}</span> ({asset.serialNumber}).
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Reason for Retirement / Disposal Note
            </label>
            <textarea
              value={retireNote}
              onChange={(e) => setRetireNote(e.target.value)}
              placeholder="E.g., Hardware motherboard failure. E-waste recycling scheduled."
              rows={2}
              required
              className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-700 flex justify-end gap-3">
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
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-3 text-sm text-rose-300">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Destructive Action</span>
              <span className="text-xs text-rose-200/80">
                This will permanently delete the asset record and all associated history logs from the database.
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-300">
            To confirm deletion, please type <span className="font-mono font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">{asset.name}</span> exactly below:
          </p>

          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={asset.name}
            required
            className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
          />

          <div className="pt-3 border-t border-slate-700 flex justify-end gap-3">
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
