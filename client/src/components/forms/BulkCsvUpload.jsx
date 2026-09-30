import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, CheckCircle2, AlertTriangle, Upload, RotateCcw } from 'lucide-react';
import Button from '../ui/Button';
import { getImportErrorMessage, importAssetsCsv } from '../../api/assetsApi';

const TEMPLATE_URL = '/asset-import-template.csv';

const COLUMN_GUIDE = [
  ['category', 'Required. Must match an existing category, e.g. Laptop, Monitor, Keyboard & Mouse, Audio & Headset, Adaptor.'],
  ['serial_number', 'Unique. Leave empty or write NA if the device has none; a serial is generated.'],
  ['name', 'Optional when brand and model are filled (name becomes "brand model").'],
  ['status', 'available, in-use or retired. Empty means in-use when assigned, otherwise available.'],
  ['assigned_to_email', 'Employee email; the employee must already exist. Only for in-use assets.'],
  ['location', 'Must match an office location, e.g. Bangalore, Mumbai, Delhi, Hyderabad.'],
  ['ownership', 'company (default) or client. Filling client_name implies client.'],
  ['cost', 'Purchase price in rupees, e.g. 82950 or 1,234.50.'],
  ['dates', 'assigned_date, purchase_date, warranty_expiry_date, received_on, return_date: DD/MM/YYYY or YYYY-MM-DD.'],
  ['parent_serial', 'For accessories such as adaptors: the serial of the laptop they belong to.'],
];

const Summary = ({ result }) => {
  const readyLabel = result.dryRun ? 'ready to import' : 'imported';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border border-success/30 bg-success/10 p-4">
        <p className="text-2xl font-bold text-success">{result.imported}</p>
        <p className="text-xs text-secondary mt-0.5">{readyLabel}</p>
      </div>
      <div className="rounded-xl border border-border bg-base/60 p-4">
        <p className="text-2xl font-bold text-primary">{result.skipped.length}</p>
        <p className="text-xs text-secondary mt-0.5">already in inventory (skipped)</p>
      </div>
      <div className={`rounded-xl border p-4 ${result.errors.length ? 'border-danger/30 bg-danger/10' : 'border-border bg-base/60'}`}>
        <p className={`text-2xl font-bold ${result.errors.length ? 'text-danger' : 'text-primary'}`}>{result.errors.length}</p>
        <p className="text-xs text-secondary mt-0.5">rows with errors (not imported)</p>
      </div>
    </div>
  );
};

const ProblemTable = ({ title, rows }) => (
  <div className="rounded-xl border border-border overflow-hidden">
    <p className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-secondary bg-base/60 border-b border-border">{title}</p>
    <div className="max-h-72 overflow-y-auto divide-y divide-border">
      {rows.map((row) => (
        <div key={`${row.row}-${row.serial}`} className="px-4 py-2.5 text-sm flex gap-3">
          <span className="font-mono text-xs text-secondary shrink-0 w-14">Row {row.row}</span>
          <div className="min-w-0">
            {row.serial && <p className="font-mono text-xs text-secondary truncate">{row.serial}</p>}
            {(row.messages || [row.reason]).map((message) => (
              <p key={message} className="text-primary break-words">{message}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function BulkCsvUpload() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runImport = async (selectedFile, dryRun) => {
    setBusy(true);
    try {
      const res = await importAssetsCsv(selectedFile, { dryRun });
      const data = res.data?.data;
      setResult(data);
      if (!dryRun) toast.success(`Imported ${data.imported} assets`);
    } catch (err) {
      toast.error(getImportErrorMessage(err));
      if (dryRun) reset();
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);
    runImport(selected, true);
  };

  const isDone = result && !result.dryRun;

  return (
    <div className="space-y-6 bg-surface rounded-2xl border border-border/80 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-accent" /> Bulk upload from CSV
          </h2>
          <p className="text-sm text-secondary mt-1">
            Fill in the template (one asset per row), then upload it. The file is checked first; nothing is saved until you confirm.
          </p>
        </div>
        <a
          href={TEMPLATE_URL}
          download="asset-import-template.csv"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium rounded-lg bg-surface hover:bg-raised text-primary border border-border shadow-sm shrink-0"
        >
          <Download className="w-4 h-4" /> Download template
        </a>
      </div>

      <details className="rounded-xl border border-border bg-base/40 group">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">Column guide</summary>
        <dl className="px-4 pb-4 grid gap-2 text-sm">
          {COLUMN_GUIDE.map(([column, description]) => (
            <div key={column} className="grid sm:grid-cols-[10rem_1fr] gap-1 sm:gap-3">
              <dt className="font-mono text-xs text-accent pt-0.5">{column}</dt>
              <dd className="text-secondary">{description}</dd>
            </div>
          ))}
        </dl>
      </details>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {!file && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed border-border hover:border-accent/60 hover:bg-accent/5 transition-colors p-8 flex flex-col items-center gap-2 text-center cursor-pointer"
        >
          <Upload className="w-7 h-7 text-accent" />
          <span className="text-sm font-semibold text-primary">Choose a CSV file</span>
          <span className="text-xs text-secondary">Up to 5 MB. In Excel or Google Sheets use File → Save as / Download → CSV.</span>
        </button>
      )}

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-base/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary truncate">{file.name}</p>
            <p className="text-xs text-secondary">
              {busy ? 'Working…' : isDone ? 'Import finished' : result ? `Checked ${result.total} rows` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
            <RotateCcw className="w-4 h-4" /> Choose another file
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <Summary result={result} />

          {result.unknownColumns?.length > 0 && (
            <p className="text-xs text-warning flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              These columns are not part of the template and were ignored: {result.unknownColumns.join(', ')}
            </p>
          )}

          {result.errors.length > 0 && (
            <ProblemTable title="Fix these rows and upload again" rows={result.errors} />
          )}
          {result.skipped.length > 0 && (
            <ProblemTable title="Skipped: serial number already in inventory" rows={result.skipped} />
          )}

          {!isDone && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-2">
              {result.errors.length > 0 && result.imported > 0 && (
                <p className="text-xs text-secondary sm:mr-auto">Rows with errors will be left out.</p>
              )}
              <Button
                onClick={() => runImport(file, false)}
                loading={busy}
                disabled={result.imported === 0}
              >
                <Upload className="w-4 h-4" />
                {result.imported === 0 ? 'Nothing to import' : `Import ${result.imported} asset${result.imported === 1 ? '' : 's'}`}
              </Button>
            </div>
          )}

          {isDone && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
              <p className="text-sm text-success flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {result.imported} assets added to inventory.
              </p>
              <Link to="/inventory" className="text-sm font-semibold text-accent hover:underline">
                View in Inventory →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
