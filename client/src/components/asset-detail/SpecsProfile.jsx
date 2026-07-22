import React, { useState } from 'react';
import Badge from '../ui/Badge';
import StatusPill from '../ui/StatusPill';
import Button from '../ui/Button';
import { Copy, Check, Edit2, X, MapPin, DollarSign, Calendar, Tag, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SpecsProfile({ asset, onUpdateNotes }) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(asset?.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!asset) return null;

  const handleCopySerial = () => {
    if (!asset.serialNumber) return;
    navigator.clipboard.writeText(asset.serialNumber);
    setCopied(true);
    toast.success('Serial number copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await onUpdateNotes(notesValue.trim());
      setIsEditingNotes(false);
    } catch (err) {
      // Error toast already handled inside hook
    } finally {
      setSavingNotes(false);
    }
  };

  const formattedCost = useMemoFormatCost(asset.costCents);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700/80 p-6 shadow-sm space-y-6">
      {/* Header: Name, Category, Status */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-700/60 pb-5">
        <div className="flex items-start gap-3.5">
          <Badge
            badgeChar={asset.categoryBadgeChar || asset.categoryName || '?'}
            color={asset.categoryColor}
            title={asset.categoryName || 'Category'}
            className="!w-10 !h-10 !text-sm mt-0.5"
          />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">{asset.name}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-700/80 text-slate-300 border border-slate-600/70">
                {asset.categoryName || 'Uncategorized'}
              </span>
            </div>
            {asset.model && <p className="text-sm text-slate-400 mt-1">Model: {asset.model}</p>}
          </div>
        </div>
        <div className="self-start">
          <StatusPill status={asset.status} />
        </div>
      </div>

      {/* Grid of Spec Attributes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
        {/* Serial Number with Copy */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Serial Number
            </span>
            <span className="font-mono text-xs sm:text-sm text-indigo-300 font-medium select-all block truncate">
              {asset.serialNumber}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopySerial}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Copy serial number"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Location */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
            <MapPin className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Office Location</span>
            <span className="text-slate-200 font-medium">{asset.location || 'Not specified'}</span>
          </div>
        </div>

        {/* Purchase Cost */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Purchase Cost</span>
            <span className="text-slate-200 font-mono font-medium">{formattedCost}</span>
          </div>
        </div>

        {/* Purchase Date */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
            <Calendar className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Purchase Date</span>
            <span className="text-slate-200 font-mono font-medium">{asset.purchaseDate || 'Unknown date'}</span>
          </div>
        </div>
      </div>

      {/* Inline Notes Editor per PRD 6.3.1 & 6.3.3 */}
      <div className="pt-2 border-t border-slate-700/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Operational & Audit Notes
          </span>
          {!isEditingNotes && asset.status !== 'retired' && (
            <button
              type="button"
              onClick={() => {
                setNotesValue(asset.notes || '');
                setIsEditingNotes(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Notes</span>
            </button>
          )}
        </div>

        {isEditingNotes ? (
          <div className="space-y-3">
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="Add tracking notes, repair history, or special considerations..."
              rows={3}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingNotes(false)}
                disabled={savingNotes}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveNotes}
                loading={savingNotes}
              >
                Save Notes
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-700/40 text-sm text-slate-300 min-h-[64px] whitespace-pre-wrap">
            {asset.notes || <span className="text-slate-500 italic">No notes recorded for this asset yet.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function useMemoFormatCost(cents = 0) {
  if (cents === null || cents === undefined || isNaN(cents)) return '$0.00';
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars);
}
