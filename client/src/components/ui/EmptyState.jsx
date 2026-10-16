import React from 'react';
import { PackageOpen } from 'lucide-react';
import Button from './Button';

export default function EmptyState({
  icon: Icon = PackageOpen,
  title = 'No data found',
  description = 'There are no items matching your current criteria.',
  actionText,
  onAction,
  // 'sm' for empty lists inside a card (dashboards), 'md' for whole pages.
  size = 'md',
  children,
}) {
  return (
    <div className={`flex flex-col items-center justify-center ${size === 'sm' ? 'py-8' : 'py-14'} px-4 text-center rounded-xl bg-surface/40 border border-dashed border-border/70`}>
      <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center text-secondary mb-3.5 shadow-sm">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>
      <h3 className="text-base font-semibold text-primary mb-1">{title}</h3>
      {description && <p className="text-sm text-secondary max-w-md mb-4">{description}</p>}
      {actionText && onAction && (
        <Button size={size === 'sm' ? 'sm' : 'md'} onClick={onAction}>{actionText}</Button>
      )}
      {children}
    </div>
  );
}
