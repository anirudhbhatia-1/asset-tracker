import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Field, { Input, Textarea } from '../ui/Field';
import AssignmentModal from '../forms/AssignmentModal';
import StatusPill from '../ui/StatusPill';
import { UserPlus, CornerDownLeft, Archive, Trash2, ShieldAlert, AlertTriangle } from 'lucide-react';

export default function LifecycleActions({ asset, canAssign = false, canDelete = false, onAssign, onReturn, onRetire, onDelete }) {
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
  const isClientAsset = asset.assetType === 'client';
  // Already handed back to the client; the server refuses to assign it again.
  const isReturnedToClient = isClientAsset && asset.status === 'returned';

  // Each dialog opens with empty inputs, so text typed for a cancelled
  // action never carries over to the next one.
  const openReturnModal = () => { setReturnNote(''); setIsReturnModalOpen(true); };
  const closeReturnModal = () => { setIsReturnModalOpen(false); setReturnNote(''); };
  const openRetireModal = () => { setRetireNote(''); setIsRetireModalOpen(true); };
  const closeRetireModal = () => { setIsRetireModalOpen(false); setRetireNote(''); };
  const openDeleteModal = () => { setDeleteConfirmText(''); setIsDeleteModalOpen(true); };
  const closeDeleteModal = () => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); };

  const handleReturnConfirm = async () => {
    setSubmittingAction(true);
    try {
      await onReturn(returnNote.trim());
      closeReturnModal();
    } catch {
      // useAsset already showed the error toast; keep the dialog open.
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRetireConfirm = async () => {
    if (!retireNote.trim()) return;
    setSubmittingAction(true);
    try {
      await onRetire(retireNote.trim());
      closeRetireModal();
    } catch {
      // useAsset already showed the error toast; keep the dialog open.
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
    } catch {
      // useAsset already showed the error toast; keep the dialog open.
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <Card>
      <CardHeader level={3} title="Lifecycle & Operational Controls" actions={<StatusPill status={asset.status} />} />
      <CardBody className="space-y-4">

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

      {isClientAsset && (
        <p className="text-xs text-secondary mb-3">
          Client-owned: it can only be assigned and returned to the client. It can’t be reassigned, retired or deleted.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {/* Assign / Reassign Button — a client-owned asset in use can only
            be returned to the client, never passed straight to someone else. */}
        {canAssign && !isRetired && !isReturnedToClient && !(isClientAsset && asset.status === 'in-use') && (
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
        {canAssign && isReturnedToClient && (
          <p className="text-xs text-secondary">
            Returned to {asset.clientName || 'the client'}. It can’t be assigned again.
          </p>
        )}

        {/* Return to Stock Button */}
        {canAssign && asset.status === 'in-use' && !isRetired && (
          <Button
            variant="secondary"
            onClick={openReturnModal}
            disabled={Boolean(asset.parentId)}
            title={asset.parentId ? 'Managed via parent asset' : undefined}
            className="flex-1 sm:flex-initial"
          >
            <CornerDownLeft className="w-4 h-4" />
            <span>{isClientAsset ? 'Return to Client' : 'Return to Stock'}</span>
          </Button>
        )}

        {/* Retire Asset Button (never for client-owned assets) */}
        {canDelete && !isRetired && !isClientAsset && (
          <Button
            variant="danger"
            onClick={openRetireModal}
            className="flex-1 sm:flex-initial"
          >
            <Archive className="w-4 h-4" />
            <span>Retire Asset</span>
          </Button>
        )}

        {/* Delete Asset Button (Always available to Admin). Quieter outline
            style, pushed to the far end, so it isn't mistaken for Retire. */}
        {canDelete && !isClientAsset && (
          <div className="w-full sm:w-auto sm:ml-auto pt-3 sm:pt-0 sm:pl-3 border-t sm:border-t-0 sm:border-l border-border/60">
            <Button
              variant="danger-outline"
              onClick={openDeleteModal}
              className="w-full sm:w-auto"
              title="Permanently remove asset record"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete permanently</span>
            </Button>
          </div>
        )}
      </div>
      </CardBody>

      {/* 1. Assignment Modal */}
      {canAssign && (
        <AssignmentModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          onAssign={onAssign}
          asset={asset}
        />
      )}

      {/* 2. Return to Stock Confirmation Modal */}
      {canAssign && <Modal
        isOpen={isReturnModalOpen}
        onClose={() => !submittingAction && closeReturnModal()}
        title={isClientAsset ? 'Confirm Return to Client' : 'Confirm Return to Stock'}
        footer={(
          <>
            <Button variant="secondary" onClick={closeReturnModal} disabled={submittingAction}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleReturnConfirm} loading={submittingAction}>
              <CornerDownLeft className="w-4 h-4" />
              <span>Confirm Return</span>
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Are you sure you want to unassign <span className="font-semibold text-primary">{asset.name}</span> ({asset.serialNumber}) from <span className="font-semibold text-primary">{asset.assigneeName}</span> and {isClientAsset ? `mark it as returned to ${asset.clientName || 'the client'}? It will no longer be available to assign.` : 'mark it as available in inventory?'}
          </p>

          <Field id="return-note" label="Return Inspection Note (Optional)">
            <Textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="E.g., Returned in excellent condition. Charger included."
              rows={2}
              maxLength={500}
            />
          </Field>
        </div>
      </Modal>}

      {/* 3. Retire Asset Confirmation Modal */}
      {canDelete && <Modal
        isOpen={isRetireModalOpen}
        onClose={() => !submittingAction && closeRetireModal()}
        title="Confirm Decommission & Retirement"
        footer={(
          <>
            <Button variant="secondary" onClick={closeRetireModal} disabled={submittingAction}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRetireConfirm} loading={submittingAction} disabled={!retireNote.trim()}>
              <Archive className="w-4 h-4" />
              <span>Confirm Retirement</span>
            </Button>
          </>
        )}
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
            Retiring asset: <span className="font-semibold text-primary">{asset.name}</span> ({asset.serialNumber}).
          </p>

          <Field id="retire-note" label="Reason for Retirement / Disposal Note" required>
            <Textarea
              value={retireNote}
              onChange={(e) => setRetireNote(e.target.value)}
              placeholder="E.g., Hardware motherboard failure. E-waste recycling scheduled."
              rows={2}
              maxLength={500}
            />
          </Field>
        </div>
      </Modal>}

      {/* 4. Delete Asset Confirmation Modal */}
      {canDelete && <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !submittingAction && closeDeleteModal()}
        title="Confirm Permanent Deletion"
        footer={(
          <>
            <Button variant="secondary" onClick={closeDeleteModal} disabled={submittingAction}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="delete-asset-form"
              variant="danger"
              loading={submittingAction}
              disabled={deleteConfirmText !== asset.name}
            >
              <Trash2 className="w-4 h-4" />
              <span>Permanently Delete</span>
            </Button>
          </>
        )}
      >
        <form id="delete-asset-form" onSubmit={handleDeleteConfirm} className="space-y-4">
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
            To confirm deletion, please type <span className="font-mono font-bold text-primary bg-base px-1.5 py-0.5 rounded border border-border">{asset.name}</span> exactly below:
          </p>

          <Input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={asset.name}
            aria-label={`Type ${asset.name} to confirm deletion`}
            required
            className="font-mono"
          />
        </form>
      </Modal>}
    </Card>
  );
}
