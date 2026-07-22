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
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900';

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-11 px-5 text-base gap-2.5',
  };

  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-sm focus:ring-indigo-500',
    secondary: 'bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 border border-slate-700 hover:border-slate-600 shadow-sm focus:ring-slate-500',
    danger: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-sm focus:ring-rose-500',
    ghost: 'bg-transparent hover:bg-slate-800/80 active:bg-slate-800 text-slate-300 hover:text-white focus:ring-slate-500',
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
