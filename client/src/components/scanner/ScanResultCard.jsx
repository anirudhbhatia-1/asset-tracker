import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import StatusPill from '../ui/StatusPill';
import Pill from '../ui/Pill';
import Button from '../ui/Button';
import { CheckCircle2, AlertCircle, ArrowRight, RefreshCw, MapPin, User, Building2, Tag, UserPlus, CornerDownLeft } from 'lucide-react';

// Quick actions depend on the asset's status and what the viewer may do:
// "Open details" needs assets:read, Assign/Return need assets:assign.
export default function ScanResultCard({ asset, error, onClear, canOpenDetails = false, canAssign = false, onAssign, onReturn, actionBusy = false }) {
  if (!asset && !error) return null;

  if (error) {
    return (
      <div className="w-full max-w-xl mx-auto bg-danger/10 border border-danger/30 rounded-2xl p-6 shadow-lg animate-fadeIn text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-danger/20 border border-danger/30 flex items-center justify-center text-danger shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-danger">Decoded Tag Unmatched</h4>
              <p className="text-sm text-danger mt-1 font-mono">{error}</p>
              <p className="text-xs text-secondary mt-2">
                Verify the barcode corresponds to an active hardware record in your regional database.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onClear}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </Button>
        </div>
      </div>
    );
  }

  const showAssign = canAssign && onAssign && asset.status === 'available';
  const showReturn = canAssign && onReturn && asset.status === 'in-use';

  return (
    <div className="w-full max-w-xl mx-auto bg-surface/90 backdrop-blur-md rounded-2xl border border-success/40 p-6 shadow-xl animate-fadeIn relative overflow-hidden text-left">
      {/* Top green accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-success to-success" />

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/30 flex items-center justify-center text-success shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-success">Barcode Match Confirmed</span>
            </div>
            <h3 className="text-lg font-bold text-primary mt-0.5 truncate">{asset.name}</h3>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={onClear} title="Scan another barcode">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-base/60 border border-border/60 text-xs mb-5">
        <div className="space-y-1">
          <span className="text-secondary block flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-secondary" />
            <span>Serial Number</span>
          </span>
          <span className="font-mono font-semibold text-accent block">{asset.serialNumber}</span>
        </div>

        <div className="space-y-1">
          <span className="text-secondary block">Status</span>
          <StatusPill status={asset.status} />
        </div>

        <div className="space-y-1 pt-1 border-t border-border">
          <span className="text-secondary block">Category</span>
          <div className="flex items-center gap-1.5">
            <Badge badgeChar={asset.categoryBadgeChar} color={asset.categoryColor} className="!w-5 !h-5 !text-[10px]" />
            <span className="font-medium text-primary truncate">{asset.categoryName || `Category #${asset.categoryId}`}</span>
          </div>
        </div>

        <div className="space-y-1 pt-1 border-t border-border">
          <span className="text-secondary block flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-secondary" />
            <span>Location</span>
          </span>
          <span className="font-medium text-primary block truncate">{asset.location || 'Unassigned'}</span>
        </div>
      </div>

      {asset.assigneeName && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-info-blue/10 border border-info-blue/20 text-xs text-info-blue mb-5">
          <div className="flex items-center gap-2 truncate">
            <User className="w-4 h-4 text-info-blue shrink-0" />
            <span className="font-medium truncate">Assigned to: {asset.assigneeName}</span>
          </div>
          {asset.assigneeDepartment && (
            <Pill tone="info" icon={Building2} className="font-mono shrink-0">
              {asset.assigneeDepartment}
            </Pill>
          )}
        </div>
      )}

      {(canOpenDetails || showAssign || showReturn) && (
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          {showAssign && (
            <Button variant="secondary" onClick={onAssign} disabled={actionBusy}>
              <UserPlus className="w-4 h-4 text-accent" />
              <span>Assign</span>
            </Button>
          )}
          {showReturn && (
            <Button variant="secondary" onClick={onReturn} disabled={actionBusy}>
              <CornerDownLeft className="w-4 h-4 text-warning" />
              <span>{asset.assetType === 'client' ? 'Return to client' : 'Return to stock'}</span>
            </Button>
          )}
          {canOpenDetails && (
            <Link
              to={`/inventory/${asset.id}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent text-on-accent text-xs font-semibold transition-all shadow-lg shadow-accent/20 cursor-pointer"
            >
              <span>Open details</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
