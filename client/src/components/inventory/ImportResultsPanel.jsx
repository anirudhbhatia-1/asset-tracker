import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { buildSkippedRowsCsv, downloadCsv } from '../../utils/csv';

function Stat({ label, value, tone = 'text-primary' }) {
  return (
    <div className="bg-surface/70 border border-border/60 rounded-lg px-3 py-2 min-w-[96px]">
      <span className={`block text-lg font-bold leading-tight ${tone}`}>{value}</span>
      <span className="block text-[11px] text-secondary uppercase tracking-wider">{label}</span>
    </div>
  );
}

// Summary of an Excel import: counts, every skipped reason, and a CSV of the
// skipped rows so they can be fixed and re-imported.
export default function ImportResultsPanel({ result, onDismiss }) {
  const [showSkipped, setShowSkipped] = useState(false);
  if (!result) return null;

  const skipped = Array.isArray(result.skipped) ? result.skipped : [];
  const categoriesCreated = Array.isArray(result.categoriesCreated) ? result.categoriesCreated : [];
  const hasSkipped = skipped.length > 0;

  const handleDownload = () => {
    const stamp = new Date().toISOString().substring(0, 10);
    downloadCsv(`AssetTrack_import_skipped_${stamp}.csv`, buildSkippedRowsCsv(skipped));
  };

  return (
    <div className={`rounded-xl p-4 text-sm shadow-sm border ${hasSkipped ? 'bg-warning/5 border-warning/30' : 'bg-success/10 border-success/20'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-primary">
          {hasSkipped
            ? <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            : <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
          <span>
            Excel import finished: {result.imported ?? 0} imported
            {hasSkipped && `, ${skipped.length} skipped`}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-secondary hover:text-primary px-2 py-1 rounded-lg hover:bg-surface transition-colors cursor-pointer shrink-0"
        >
          Dismiss
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <Stat label="Imported" value={result.imported ?? 0} tone="text-success" />
        <Stat label="Skipped" value={skipped.length} tone={hasSkipped ? 'text-warning' : 'text-primary'} />
        <Stat label="Categories created" value={categoriesCreated.length} />
        <Stat label="Serials generated" value={result.generatedSerials ?? 0} />
        <Stat label="Handovers" value={result.handovers ?? 0} />
      </div>

      {categoriesCreated.length > 0 && (
        <p className="text-xs text-secondary mt-2">New categories: {categoriesCreated.join(', ')}</p>
      )}

      {hasSkipped && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSkipped(v => !v)}
              aria-expanded={showSkipped}
              className="inline-flex items-center gap-1 text-xs font-medium text-warning hover:underline cursor-pointer"
            >
              {showSkipped ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {showSkipped ? 'Hide' : 'Show'} {skipped.length} skipped {skipped.length === 1 ? 'reason' : 'reasons'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface hover:bg-raised text-secondary border border-border transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download skipped rows (CSV)
            </button>
          </div>
          {showSkipped && (
            <ol className="mt-2 max-h-60 overflow-y-auto bg-surface/70 border border-border/60 rounded-lg divide-y divide-border/40 text-xs text-secondary">
              {skipped.map((reason, i) => (
                <li key={i} className="px-3 py-1.5 break-words">{reason}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
