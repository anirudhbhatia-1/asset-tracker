import React, { useState, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, Eye, EyeOff, AlertCircle, Check, Circle, Info } from 'lucide-react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import useFocusTrap from '../../hooks/useFocusTrap';
import { PASSWORD_MAX_LENGTH, passwordChecks, passwordRuleError } from '../../utils/passwordRules';
import Button from '../ui/Button';
import { controlClass } from '../ui/fieldStyles';

// The eye toggle sits inside the input, so the text keeps clear of it.
const passwordInputClass = `${controlClass(false)} pr-10`;
const labelClass = 'block text-sm font-medium text-primary';

// `required`: shown when the account must replace a temporary or shared
// password; it cannot be dismissed and the only way out is changing it or
// signing out.
const ChangePasswordModal = ({ isOpen, onClose, required = false }) => {
  const { logout, user } = useAuth();
  
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
  const rulesId = `${fieldId}-rules`;
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen, () => handleClose());

  if (!isOpen) return null;

  // The rules the server checks, ticked as the user types.
  const person = { name: user?.name, email: user?.email };
  const checks = passwordChecks(newPassword, person);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }
    const ruleError = passwordRuleError(newPassword, person);
    if (ruleError) {
      setError(ruleError);
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
              Enter your current password, then a new one that meets the rules below.
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
              <label htmlFor={`${fieldId}-current`} className={labelClass}>Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  id={`${fieldId}-current`}
                  autoComplete="current-password"
                  aria-describedby={error ? errorId : undefined}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={passwordInputClass}
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
              <label htmlFor={`${fieldId}-new`} className={labelClass}>New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  id={`${fieldId}-new`}
                  autoComplete="new-password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  aria-describedby={error ? `${rulesId} ${errorId}` : rulesId}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={passwordInputClass}
                  placeholder="At least 10 characters"
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
              <ul id={rulesId} aria-label="Password rules" className="pt-1 space-y-1">
                {checks.map((check) => {
                  const Icon = check.met === null ? Info : check.met ? Check : Circle;
                  const tone = check.met === null ? 'text-secondary' : check.met ? 'text-success' : 'text-secondary';
                  return (
                    <li key={check.key} className={`flex items-start gap-2 text-xs ${tone}`}>
                      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${check.met ? 'stroke-[3]' : ''}`} aria-hidden="true" />
                      <span>
                        {check.label}
                        {check.met !== null && <span className="sr-only">{check.met ? ' (done)' : ' (not yet)'}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-confirm`} className={labelClass}>Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  id={`${fieldId}-confirm`}
                  autoComplete="new-password"
                  aria-describedby={error ? errorId : undefined}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={passwordInputClass}
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
          <Button
            variant="ghost"
            onClick={required ? logout : handleClose}
            disabled={loading}
          >
            {required ? 'Sign out' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            form="change-password-form"
            loading={loading}
          >
            {loading ? 'Updating…' : 'Change Password'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ChangePasswordModal;
