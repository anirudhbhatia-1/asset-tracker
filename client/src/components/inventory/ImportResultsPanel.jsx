import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Download, Upload, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import { buildSkippedRowsCsv, downloadCsv } from '../../utils/csv';
import { formatImportError, importProblemReasons } from '../../utils/importResults';

function Stat({ label, value, tone = 'text-primary' }) {
  return (
    <div className="bg-surface/70 border border-border/60 rounded-lg px-3 py-2 min-w-[96px]">
      <span className={`block text-lg font-bold leading-tight ${tone}`}>{value}</span>
      <span className="block text-[11px] text-secondary uppercase tracking-wider">{label}</span>
    </div>
  );
}

function ProblemList({ title, items, tone, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1 text-xs font-medium ${tone} hover:underline cursor-pointer`}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {open ? 'Hide' : 'Show'} {items.length} {title}
      </button>
      {open && (
        <ol className="mt-2 max-h-60 overflow-y-auto bg-surface/70 border border-border/60 rounded-lg divide-y divide-border/40 text-xs text-secondary">
          {items.map((text, i) => (
            <li key={i} className="px-3 py-1.5 break-words">{text}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Summary of an Excel import. For a dry run (result.dryRun) it shows what
// would happen and asks for confirmation; after a real import it lists what
// was done. Errors, skipped rows and warnings can be downloaded as a CSV.
export default function ImportResultsPanel({ result, onDismiss, onConfirm, onCancel, confirming = false }) {
  if (!result) return null;

  const skipped = Array.isArray(result.skipped) ? result.skipped : [];
  const errors = Array.isArray(result.errors) ? result.errors : [];
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const categoriesCreated = Array.isArray(result.categoriesCreated) ? result.categoriesCreated : [];
  const imported = result.imported ?? 0;
  const isCheck = Boolean(result.dryRun);
  const hasProblems = skipped.length > 0 || errors.length > 0 || warnings.length > 0;

  const handleDownload = () => {
    const stamp = new Date().toISOString().substring(0, 10);
    downloadCsv(`AssetTrack_import_problems_${stamp}.csv`, buildSkippedRowsCsv(importProblemReasons(result)));
  };

  const title = isCheck
    ? `Excel file checked: ${imported} ${imported === 1 ? 'asset' : 'assets'} ready to import. Nothing has been saved yet.`
    : `Excel import finished: ${imported} imported`;

  return (
    <div className={`rounded-xl p-4 text-sm shadow-sm border ${
      errors.length > 0 ? 'bg-danger/5 border-danger/30' : hasProblems ? 'bg-warning/5 border-warning/30' : 'bg-success/10 border-success/20'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-primary">
          {errors.length > 0
            ? <XCircle className="w-4 h-4 text-danger shrink-0" />
            : hasProblems
              ? <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              : <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
          <span>{title}</span>
        </div>
        {!isCheck && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-secondary hover:text-primary px-2 py-1 rounded-lg hover:bg-surface transition-colors cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <Stat label={isCheck ? 'Ready to import' : 'Imported'} value={imported} tone="text-success" />
        <Stat label="Errors" value={errors.length} tone={errors.length ? 'text-danger' : 'text-primary'} />
        <Stat label="Skipped" value={skipped.length} tone={skipped.length ? 'text-warning' : 'text-primary'} />
        <Stat label="Warnings" value={warnings.length} tone={warnings.length ? 'text-warning' : 'text-primary'} />
        <Stat label={isCheck ? 'Categories to create' : 'Categories created'} value={categoriesCreated.length} />
        <Stat label="Serials generated" value={result.generatedSerials ?? 0} />
        <Stat label="Handovers" value={result.handovers ?? 0} />
      </div>

      {categoriesCreated.length > 0 && (
        <p className="text-xs text-secondary mt-2">
          {isCheck ? 'Categories that will be created' : 'New categories'}: {categoriesCreated.join(', ')}
        </p>
      )}

      {hasProblems && (
        <div className="mt-3 space-y-2">
          <ProblemList
            title={`${errors.length === 1 ? 'row' : 'rows'} with errors (not imported)`}
            items={errors.map(formatImportError)}
            tone="text-danger"
            defaultOpen={isCheck}
          />
          <ProblemList
            title={`skipped ${skipped.length === 1 ? 'reason' : 'reasons'}`}
            items={skipped}
            tone="text-warning"
          />
          <ProblemList
            title={warnings.length === 1 ? 'warning' : 'warnings'}
            items={warnings}
            tone="text-warning"
            defaultOpen={isCheck}
          />
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface hover:bg-raised text-secondary border border-border transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download problem rows (CSV)
          </button>
        </div>
      )}

      {isCheck && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 mt-4">
          {errors.length > 0 && imported > 0 && (
            <p className="text-xs text-secondary sm:mr-auto">Rows with errors will be left out.</p>
          )}
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} loading={confirming} disabled={imported === 0}>
            <Upload className="w-4 h-4" />
            {imported === 0 ? 'Nothing to import' : `Import ${imported} asset${imported === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}
    </div>
  );
}
