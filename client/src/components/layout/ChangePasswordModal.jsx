import React, { useState, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import useFocusTrap from '../../hooks/useFocusTrap';

// `required`: shown when the account must replace a temporary or shared
// password; it cannot be dismissed and the only way out is changing it or
// signing out.
const ChangePasswordModal = ({ isOpen, onClose, required = false }) => {
  const { logout } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef(null);
  const titleId = useId();
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen, () => handleClose());

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword,
        newPassword
      });
      
      toast.success('Password changed successfully. Please log in again.');
      onClose();
      // Force logout as sessions have been invalidated
      await logout();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading || required) return;
    setError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-base/75 backdrop-blur-sm animate-fadeIn" onClick={handleClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} 
        className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-border/80 flex flex-col max-h-[90dvh] animate-scaleUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-base/50 shrink-0 rounded-t-2xl">
          <h2 id={titleId} className="text-lg font-bold text-primary flex items-center gap-2">
            <Lock className="w-5 h-5 text-accent" />
            {required ? 'Set a New Password' : 'Change Password'}
          </h2>
          {!required && (
            <button type="button"
              aria-label="Close"
              onClick={handleClose}
              className="p-2.5 sm:p-2 -mr-2 rounded-lg text-secondary hover:text-primary hover:bg-raised/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {required && (
            <p className="mb-5 text-sm text-secondary">
              For security, you need to choose a new password before using AssetTrack.
              Enter your current password, then a new one of at least 8 characters.
              You will be asked to sign in again afterwards.
            </p>
          )}
          {error && (
            <div id={errorId} role="alert" className="mb-6 p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-error/90">{error}</p>
            </div>
          )}

          <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-current`} className="text-sm font-semibold text-primary block">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  id={`${fieldId}-current`}
                  autoComplete="current-password"
                  aria-describedby={error ? errorId : undefined}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-base border border-border rounded-xl px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all pr-10"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                  tabIndex="-1"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-new`} className="text-sm font-semibold text-primary block">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  id={`${fieldId}-new`}
                  autoComplete="new-password"
                  aria-describedby={error ? errorId : undefined}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-base border border-border rounded-xl px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all pr-10"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                  tabIndex="-1"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-confirm`} className="text-sm font-semibold text-primary block">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  id={`${fieldId}-confirm`}
                  autoComplete="new-password"
                  aria-describedby={error ? errorId : undefined}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-base border border-border rounded-xl px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all pr-10"
                  placeholder="Type new password again"
                />
                <button
                  type="button"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                  tabIndex="-1"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 bg-base/50 flex justify-end gap-3 shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={required ? logout : handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-secondary hover:text-primary hover:bg-raised/60 rounded-xl transition-all disabled:opacity-50"
          >
            {required ? 'Sign out' : 'Cancel'}
          </button>
          <button
            type="submit"
            form="change-password-form"
            disabled={loading}
            className="px-6 py-2 text-sm font-bold bg-accent hover:bg-accent/90 text-on-accent rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-on-accent/30 border-t-on-accent rounded-full animate-spin" />
                Updating...
              </>
            ) : (
              'Change Password'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ChangePasswordModal;
