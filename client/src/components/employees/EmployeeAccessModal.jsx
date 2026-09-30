import React, { useEffect, useState } from 'react';
import { KeyRound, UserX, Copy, Check, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

// Confirms and runs a login-access action for an employee:
//   mode 'reset'  → onResetPassword(id) resolves to the temporary password,
//                   shown here once with a copy button.
//   mode 'revoke' → onRevokeAccess(id) removes the login.
// The employees hook shows success/error toasts; this modal only keeps
// itself open on failure so the admin can retry or cancel.
export default function EmployeeAccessModal({ isOpen, mode, employee, onClose, onResetPassword, onRevokeAccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSubmitting(false);
      setTempPassword('');
      setCopied(false);
    }
  }, [isOpen, mode, employee]);

  if (!employee) return null;

  const isReset = mode === 'reset';

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      if (isReset) {
        const password = await onResetPassword(employee.id);
        if (password) {
          setTempPassword(password);
        } else {
          onClose();
        }
      } else {
        await onRevokeAccess(employee.id);
        onClose();
      }
    } catch {
      // The employees hook already showed the server's message as a toast.
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      toast.success('Temporary password copied');
    } catch {
      toast.error('Could not copy; select the password and copy it manually');
    }
  };

  // Once the password is on screen, closing drops it for good.
  const handleClose = () => {
    setTempPassword('');
    onClose();
  };

  const title = isReset ? 'Reset Password' : 'Revoke Login Access';

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : handleClose} title={title} maxWidth="max-w-md">
      {tempPassword ? (
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            A new temporary password was issued for <strong className="text-primary">{employee.name}</strong>.
            They have been signed out and must change it at their next login.
          </p>
          <div className="p-4 rounded-xl bg-base border border-border space-y-3">
            <div>
              <span className="block text-xs text-secondary mb-1">Email</span>
              <code className="text-sm font-bold text-primary break-all">{employee.email}</code>
            </div>
            <div>
              <span className="block text-xs text-secondary mb-1">Temporary Password</span>
              <div className="flex items-center gap-2">
                <code className="text-sm font-bold text-accent select-all bg-accent/10 px-2 py-1 rounded break-all">{tempPassword}</code>
                <Button variant="secondary" size="sm" onClick={handleCopy} title="Copy temporary password">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>
          </div>
          <p role="note" className="flex items-start gap-2 text-xs text-warning">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>This password is shown only once. Copy it now and share it securely; it cannot be viewed again.</span>
          </p>
          <div className="pt-4 border-t border-border flex justify-end">
            <Button variant="primary" onClick={handleClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-secondary">
            {isReset ? (
              <>Issue a new temporary password for <strong className="text-primary">{employee.name}</strong> ({employee.email})?
                They will be signed out everywhere and must choose a new password at their next login.</>
            ) : (
              <>Remove login access for <strong className="text-primary">{employee.name}</strong> ({employee.email})?
                They will be signed out and can no longer sign in. Their employee profile and assigned assets are kept.</>
            )}
          </p>
          <div className="pt-4 border-t border-border flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>Cancel</Button>
            <Button variant={isReset ? 'primary' : 'danger'} onClick={handleConfirm} loading={submitting}>
              {isReset ? <KeyRound className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
              <span>{isReset ? 'Reset Password' : 'Revoke Access'}</span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
