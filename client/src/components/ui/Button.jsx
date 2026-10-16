import React from 'react';
import Spinner from './Spinner';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'success' | 'danger' | 'danger-outline' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  title,
  // Anything else (form, aria-label, id, ref…) goes to the <button>.
  ...rest
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition duration-150 rounded-lg shrink-0 cursor-pointer';

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs gap-1.5 min-h-[44px] sm:min-h-[32px]',
    md: 'h-10 px-4 text-sm gap-2 min-h-[44px] sm:min-h-[40px]',
    lg: 'h-11 px-5 text-base gap-2.5 min-h-[44px] sm:min-h-[44px]',
  };

  const variantClasses = {
    primary: 'bg-accent hover:bg-accent-hover active:bg-accent-hover text-on-accent shadow-sm',
    secondary: 'bg-surface hover:bg-raised active:bg-base text-primary border border-border hover:border-border shadow-sm',
    danger: 'bg-danger hover:bg-danger/90 active:bg-danger text-on-accent shadow-sm',
    // Quieter destructive action (e.g. permanent delete next to a primary danger action).
    'danger-outline': 'bg-transparent hover:bg-danger/10 active:bg-danger/15 text-danger border border-danger/40',
    ghost: 'bg-transparent hover:bg-raised active:bg-raised text-secondary hover:text-primary',
    // Confirming something good (e.g. "Confirm resolution").
    success: 'bg-success hover:bg-success/90 active:bg-success text-on-accent shadow-sm',
  };

  // Slight press-in on click/tap; skipped when the button can't be used.
  const disabledClasses = (disabled || loading)
    ? 'opacity-40 cursor-not-allowed pointer-events-none'
    : 'active:scale-[0.98]';

  return (
    <button
      {...rest}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.primary} ${disabledClasses} ${className}`}
    >
      {loading ? (
        <>
          <Spinner size="sm" className="!w-4 !h-4" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
