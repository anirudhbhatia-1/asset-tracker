import React from 'react';
import { PackageOpen } from 'lucide-react';

export default function EmptyState({
  icon: Icon = PackageOpen,
  title = 'No data found',
  description = 'There are no items matching your current criteria.',
  actionText,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-xl bg-surface/40 border border-dashed border-border/70">
      <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center text-secondary mb-3.5 shadow-sm">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>
      <h3 className="text-base font-semibold text-primary mb-1">{title}</h3>
      <p className="text-sm text-secondary max-w-md mb-4">{description}</p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-accent hover:bg-accent text-white shadow-sm transition-colors cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
