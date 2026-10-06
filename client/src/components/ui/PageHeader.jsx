import React from 'react';

/**
 * Shared page title block: the page's single <h1>, an optional subtitle and a
 * right-aligned action area that stacks under the title below lg (1024px), so
 * long titles don't wrap beside a toolbar on tablets and small laptops.
 *
 * - `icon`     lucide icon component shown before the title (decorative)
 * - `leading`  element rendered before the title block (e.g. a back link)
 * - `children` extra content rendered under the subtitle
 */
export default function PageHeader({ icon: Icon, title, subtitle, actions, leading, children, className = '' }) {
  return (
    <header className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-4 min-w-0">
        {leading}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-primary tracking-tight flex items-center gap-2.5">
            {Icon && <Icon className="w-6 h-6 text-accent shrink-0" aria-hidden="true" />}
            <span className="min-w-0">{title}</span>
          </h1>
          {subtitle && <p className="text-sm text-secondary mt-1">{subtitle}</p>}
          {children}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
