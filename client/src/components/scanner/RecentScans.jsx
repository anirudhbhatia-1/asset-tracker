import React from 'react';
import { History, ChevronRight } from 'lucide-react';
import StatusPill from '../ui/StatusPill';
import Button from '../ui/Button';

// Last few successful lookups this session; clicking one re-opens its card.
export default function RecentScans({ scans = [], activeId = null, onSelect, onClear, disabled = false }) {
  if (scans.length === 0) return null;

  return (
    <div className="w-full max-w-xl mx-auto bg-surface rounded-xl border border-border/60 p-4 shadow-sm text-left">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-accent" />
          <h4 className="text-sm font-semibold text-primary">Recent scans</h4>
        </div>
        {onClear && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
      <ul className="space-y-1.5">
        {scans.map((scan) => (
          <li key={scan.id}>
            <button
              type="button"
              onClick={() => onSelect(scan)}
              disabled={disabled}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-50 ${
                scan.id === activeId ? 'border-accent/40 bg-accent/5' : 'border-border/60 bg-base/60 hover:bg-raised/50'
              }`}
            >
              <div className="min-w-0">
                <span className="block text-sm font-medium text-primary truncate">{scan.name}</span>
                <span className="block text-[11px] font-mono text-secondary truncate">{scan.serialNumber}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill status={scan.status} />
                <ChevronRight className="w-4 h-4 text-secondary" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
