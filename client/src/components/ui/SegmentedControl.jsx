import React, { useRef } from 'react';

/**
 * One style for every switch / filter-tab row in the app.
 *
 *   <SegmentedControl
 *     label="Inventory view"                       // accessible name
 *     value={view}
 *     onChange={setView}
 *     options={[{ value: 'assets', label: 'Assets' }, { value: 'bulk', label: 'Bulk items', count: 3 }]}
 *   />
 *
 * Renders a tablist with roving focus (arrow keys move between options).
 * It never wraps; on narrow screens it scrolls sideways without a visible
 * scrollbar.
 */
export default function SegmentedControl({ options, value, onChange, label, size = 'md', className = '' }) {
  const buttonsRef = useRef([]);
  const pad = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-sm';

  const handleKeyDown = (event, index) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    buttonsRef.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`inline-flex max-w-full overflow-x-auto scrollbar-none bg-surface border border-border rounded-xl p-1 gap-1 ${className}`}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => { buttonsRef.current[index] = el; }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`${pad} font-medium rounded-lg whitespace-nowrap transition-[color,background-color,transform] duration-150 active:scale-[0.97] cursor-pointer inline-flex items-center gap-1.5 ${
              selected
                ? 'bg-accent/10 text-accent ring-1 ring-accent/30'
                : 'text-secondary hover:text-primary hover:bg-raised active:bg-raised'
            }`}
          >
            {option.icon ? <option.icon className="w-4 h-4" aria-hidden="true" /> : null}
            {option.label}
            {option.count != null && (
              <span className={`text-[11px] px-1.5 rounded-full ${selected ? 'bg-accent/15' : 'bg-raised'}`}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
