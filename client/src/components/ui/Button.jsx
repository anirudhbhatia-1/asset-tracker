import React from 'react';
import Spinner from './Spinner';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  title,
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg shrink-0 cursor-pointer';

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs gap-1.5 min-h-[44px] sm:min-h-[32px]',
    md: 'h-10 px-4 text-sm gap-2 min-h-[44px] sm:min-h-[40px]',
    lg: 'h-11 px-5 text-base gap-2.5 min-h-[44px] sm:min-h-[44px]',
  };

  const variantClasses = {
    primary: 'bg-accent hover:bg-accent active:bg-accent-hover text-on-accent shadow-sm',
    secondary: 'bg-surface hover:bg-raised active:bg-base text-primary border border-border hover:border-border shadow-sm',
    danger: 'bg-danger hover:bg-danger/90 active:bg-danger text-on-accent shadow-sm',
    ghost: 'bg-transparent hover:bg-surface/80 active:bg-surface text-secondary hover:text-primary',
  };

  const disabledClasses = (disabled || loading)
    ? 'opacity-40 cursor-not-allowed pointer-events-none'
    : '';

  return (
    <button
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
