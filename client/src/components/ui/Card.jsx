import React from 'react';

// The standard content panel: one border, radius and shadow everywhere.
export default function Card({ as: Tag = 'section', className = '', children, ...props }) {
  return (
    <Tag {...props} className={`bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col ${className}`}>
      {children}
    </Tag>
  );
}

/** Card title bar: icon, heading (h2 by default) and optional actions on the right. */
export function CardHeader({ icon: Icon, title, actions, id, level = 2, className = '' }) {
  const Heading = `h${level}`;
  return (
    <div className={`px-4 py-3 border-b border-border bg-base/50 flex items-center justify-between gap-3 min-h-[56px] ${className}`}>
      <Heading id={id} className="text-sm font-semibold text-primary flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />}
        <span className="truncate">{title}</span>
      </Heading>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={`p-4 flex-1 ${className}`}>{children}</div>;
}
