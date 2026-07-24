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
    <div className="bg-surface rounded-xl border border-border/80 p-6 shadow-sm space-y-6">
      {/* Header: Name, Category, Status */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-start gap-3.5">
          <Badge
            badgeChar={asset.categoryBadgeChar || asset.categoryName || '?'}
            color={asset.categoryColor}
            title={asset.categoryName || 'Category'}
            className="!w-10 !h-10 !text-sm mt-0.5"
          />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-primary tracking-tight">{asset.name}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-raised/80 text-secondary border border-border/70">
                {asset.categoryName || 'Uncategorized'}
              </span>
            </div>
            {asset.model && <p className="text-sm text-secondary mt-1">Model: {asset.model}</p>}
          </div>
        </div>
        <div className="self-start">
          <StatusPill status={asset.status} />
        </div>
      </div>

      {/* Grid of Spec Attributes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
        {/* Serial Number with Copy */}
        <div className="bg-base/60 p-3.5 rounded-xl border border-border/60 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-1">
              Serial Number
            </span>
            <span className="font-mono text-xs sm:text-sm text-accent font-medium select-all block truncate">
              {asset.serialNumber}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopySerial}
            className="p-2 rounded-lg text-secondary hover:text-white hover:bg-surface transition-colors shrink-0 cursor-pointer"
            title="Copy serial number"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Location */}
        <div className="bg-base/60 p-3.5 rounded-xl border border-border/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-secondary shrink-0">
            <MapPin className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Office Location</span>
            <span className="text-primary font-medium">{asset.location || 'Not specified'}</span>
          </div>
        </div>

        {/* Purchase Cost */}
        <div className="bg-base/60 p-3.5 rounded-xl border border-border/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-secondary shrink-0">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Purchase Cost</span>
            <span className="text-primary font-mono font-medium">{formattedCost}</span>
          </div>
        </div>

        {/* Purchase Date */}
        <div className="bg-base/60 p-3.5 rounded-xl border border-border/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-secondary shrink-0">
            <Calendar className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Purchase Date</span>
            <span className="text-primary font-mono font-medium">{asset.purchaseDate || 'Unknown date'}</span>
          </div>
        </div>
      </div>

      {/* Inline Notes Editor per PRD 6.3.1 & 6.3.3 */}
      <div className="pt-2 border-t border-border/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
            Operational & Audit Notes
          </span>
          {!isEditingNotes && asset.status !== 'retired' && (
            <button
              type="button"
              onClick={() => {
                setNotesValue(asset.notes || '');
                setIsEditingNotes(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent font-medium cursor-pointer"
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
              className="w-full rounded-xl bg-base border border-border p-3 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
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
          <div className="bg-base/40 p-3.5 rounded-xl border border-border/40 text-sm text-secondary min-h-[64px] whitespace-pre-wrap">
            {asset.notes || <span className="text-secondary italic">No notes recorded for this asset yet.</span>}
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
