import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import StatusPill from '../ui/StatusPill';
import Button from '../ui/Button';
import { getEmployeeAssets } from '../../api/employeesApi';
import { useAuth } from '../../context/AuthContext';
import { useStock, useStockHoldings } from '../../hooks/useStock';
import { formatDate } from '../../utils/formatters';
import { validateQuantity, parseQuantity, holdingLabel } from '../../utils/stock';
import { workModeLabel } from '../../utils/workMode';
import { Laptop, Calendar, MapPin, Mail, Building2, ShieldCheck, PackageX, ExternalLink, Package, Undo2, Home } from 'lucide-react';

/** One bulk item the employee holds, with an inline "Return" form. */
function HoldingRow({ holding, employeeName, canReturn, onReturn }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const idBase = `drawer-return-${holding.stockItemId}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qtyError = validateQuantity(quantity, { min: 1, max: holding.quantity });
    setError(qtyError);
    if (qtyError) return;
    setSubmitting(true);
    try {
      await onReturn(holding.stockItemId, parseQuantity(quantity));
      setOpen(false);
    } catch {
      // The hook already showed the error toast.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li className="bg-base/80 p-3 rounded-xl border border-border/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary break-words">{holdingLabel(holding)}</p>
          <p className="text-[11px] text-secondary">
            {[holding.categoryName, holding.location].filter(Boolean).join(' · ')}
            {holding.firstAssignedAt && `${holding.categoryName || holding.location ? ' · ' : ''}since ${formatDate(holding.firstAssignedAt)}`}
          </p>
        </div>
        {canReturn && !open && (
          <Button size="sm" variant="secondary" onClick={() => { setQuantity('1'); setError(null); setOpen(true); }}>
            <Undo2 className="w-3.5 h-3.5" />
            <span>Return</span>
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={handleSubmit} noValidate className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-28">
            <label htmlFor={`${idBase}-qty`} className="block text-[11px] font-semibold text-secondary uppercase tracking-wider mb-1">
              Quantity
            </label>
            <input
              id={`${idBase}-qty`}
              type="number"
              inputMode="numeric"
              min="1"
              max={holding.quantity}
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${idBase}-error` : undefined}
              className="w-full rounded-lg bg-surface border border-border px-2.5 py-1.5 text-sm font-mono text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button size="sm" type="submit" loading={submitting}>Return to stock</Button>
          {error
            ? <p id={`${idBase}-error`} role="alert" className="w-full text-xs text-danger">{error}</p>
            : <p className="w-full text-xs text-secondary">{employeeName} has {holding.quantity}. Returned units go back on the shelf.</p>}
        </form>
      )}
    </li>
  );
}

export default function EmployeeAssetDrawer({ isOpen, onClose, employee }) {
  const { hasPermission } = useAuth();
  const canReturnStock = hasPermission('assets:assign');
  const { returnStock } = useStock();
  const {
    holdings, loading: holdingsLoading, error: holdingsError, refresh: refreshHoldings,
  } = useStockHoldings(employee?.id, isOpen);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !employee?.id) return;
    setAssets([]);
    setError(null);

    const fetchAssets = async () => {
      setLoading(true);
      try {
        const res = await getEmployeeAssets(employee.id);
        setAssets(res.data?.data || (Array.isArray(res.data) ? res.data : []));
      } catch {
        setError('Failed to fetch assigned assets.');
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [isOpen, employee]);

  if (!employee) return null;

  const safeAssets = Array.isArray(assets) ? assets : [];

  const handleReturnStock = async (stockItemId, quantity) => {
    await returnStock(stockItemId, { employeeId: employee.id, quantity });
    await refreshHoldings();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Hardware Assigned to: ${employee.name}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Employee Profile Header */}
        <div className="bg-base/60 p-4 rounded-xl border border-border/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-primary font-bold text-base shrink-0">
              {employee.avatarUrl ? (
                <img src={employee.avatarUrl} alt={employee.name} className="w-full h-full rounded-xl object-cover" />
              ) : (
                <span>
                  {employee.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-primary">{employee.name}</h3>
                {employee.isGoogleSynced === 1 && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Google Synced</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary flex items-center gap-2 mt-1">
                {employee.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-secondary" />
                    <span>{employee.email}</span>
                  </span>
                )}
                {employee.department && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-accent" />
                    <span>{employee.department}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-secondary bg-surface px-3 py-1.5 rounded-lg border border-border">
              <Home className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Work mode: <strong className="text-primary font-semibold">{workModeLabel(employee.workMode)}</strong></span>
            </div>
            {employee.location && (
              <div className="flex items-center gap-1.5 text-xs text-secondary bg-surface px-3 py-1.5 rounded-lg border border-border">
                <MapPin className="w-3.5 h-3.5 text-accent" />
                <span>{employee.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Devices Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-2">
              <Laptop className="w-4 h-4 text-accent" />
              <span>Assigned Hardware Devices ({safeAssets.length})</span>
            </h4>
          </div>

          {loading ? (
            <div className="space-y-3 py-4 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-base rounded-xl border border-border/60" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 bg-danger/10 border border-danger/30 rounded-xl text-center text-xs text-danger">
              {error}
            </div>
          ) : safeAssets.length === 0 ? (
            <div className="py-10 bg-base/40 rounded-xl border border-border/40 text-center space-y-2">
              <PackageX className="w-8 h-8 text-secondary mx-auto" />
              <p className="text-sm font-medium text-secondary">No Hardware Currently Assigned</p>
              <p className="text-xs text-secondary max-w-sm mx-auto">
                This employee does not currently have any active company devices allocated to them.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
              {safeAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-base/80 p-3.5 rounded-xl border border-border/80 flex items-center justify-between gap-3 hover:border-border transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      badgeChar={asset.categoryBadgeChar || asset.categoryName || '?'}
                      color={asset.categoryColor}
                      title={asset.categoryName}
                    />
                    <div className="min-w-0">
                      <Link
                        to={`/inventory/${asset.id}`}
                        onClick={onClose}
                        className="text-sm font-bold text-primary hover:text-accent transition-colors flex items-center gap-1.5 truncate"
                      >
                        <span className="truncate">{asset.name}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                      <div className="flex items-center gap-2.5 text-xs text-secondary mt-0.5">
                        <span className="font-mono text-accent/90 font-medium">{asset.serialNumber}</span>
                        {asset.model && <span className="text-secondary truncate">· {asset.model}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                    <StatusPill status={asset.status} />
                    {asset.assignedDate && (
                      <span className="text-[11px] font-mono text-secondary flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-secondary" />
                        <span>Since: {asset.assignedDate}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bulk items (counted, no serial numbers) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-accent" />
              <span>Bulk items ({holdings.length})</span>
            </h4>
          </div>
          {holdingsLoading && holdings.length === 0 ? (
            <div className="h-12 bg-base rounded-xl border border-border/60 animate-pulse" />
          ) : holdingsError ? (
            <p className="text-xs text-secondary">{holdingsError}</p>
          ) : holdings.length === 0 ? (
            <p className="text-xs text-secondary">No bulk items, like bags or cables, given to this employee.</p>
          ) : (
            <ul className="space-y-2">
              {holdings.map((holding) => (
                <HoldingRow
                  key={holding.stockItemId}
                  holding={holding}
                  employeeName={employee.name}
                  canReturn={canReturnStock}
                  onReturn={handleReturnStock}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close Drawer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
