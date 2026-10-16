import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import StatusPill from '../ui/StatusPill';
import Pill from '../ui/Pill';
import Button from '../ui/Button';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CLIENT_LAPTOP_POLICY, assetSpecs, showsPrice } from '../../utils/assetPolicy';

function Field({ label, children, mono = false }) {
  return (
    <div className="bg-base/60 px-3 py-2.5 rounded-lg border border-border/60 min-w-0">
      <dt className="text-[11px] font-semibold text-secondary uppercase tracking-wider">{label}</dt>
      <dd className={`text-sm text-primary font-medium mt-0.5 break-words ${mono ? 'font-mono' : ''}`}>{children}</dd>
    </div>
  );
}

// An employee's own view of a device they hold: specs, and for client
// assets the price and the loss/damage policy. Company prices are not shown.
export default function MyAssetModal({ asset, onClose, canOpenFullPage = false, onReportIssue }) {
  const isClient = asset?.assetType === 'client';
  const specs = assetSpecs(asset);
  const accessories = Array.isArray(asset?.accessories) ? asset.accessories : [];

  return (
    <Modal
      isOpen={!!asset}
      onClose={onClose}
      title="Asset details"
      maxWidth="max-w-xl"
      footer={asset && (canOpenFullPage || onReportIssue) && (
        <>
          {canOpenFullPage && (
            <Link to={`/assets/${asset.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:underline">
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Open full page
            </Link>
          )}
          {onReportIssue && (
            <Button variant="danger-outline" size="sm" onClick={() => onReportIssue(asset)}>
              Report Issue
            </Button>
          )}
        </>
      )}
    >
      {asset && (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <Badge badgeChar={asset.categoryBadgeChar || asset.categoryName?.[0] || '?'} color={asset.categoryColor} title={asset.categoryName} />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-primary break-words">{asset.name}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-secondary">{asset.categoryName || 'Uncategorized'}</span>
                <Pill tone={isClient ? 'accent' : 'neutral'} className="uppercase tracking-wider">
                  {isClient ? `Client asset${asset.clientName ? ` · ${asset.clientName}` : ''}` : 'Company asset'}
                </Pill>
              </div>
            </div>
            <StatusPill status={asset.status} />
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Serial number" mono>{asset.serialNumber}</Field>
            {asset.assignedDate && <Field label="With you since">{formatDate(asset.assignedDate)}</Field>}
            {showsPrice(asset) && <Field label="Price">{asset.costCents > 0 ? formatCurrency(asset.costCents / 100) : 'Not recorded'}</Field>}
            {asset.warrantyExpiryDate && <Field label="Warranty until">{formatDate(asset.warrantyExpiryDate)}</Field>}
            {asset.location && <Field label="Location">{asset.location}</Field>}
          </dl>

          <section aria-labelledby="my-asset-specs">
            <h4 id="my-asset-specs" className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Specifications</h4>
            {specs.length ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {specs.map((spec) => <Field key={spec.key} label={spec.label}>{spec.value}</Field>)}
              </dl>
            ) : (
              <p className="text-sm text-secondary italic">No specifications recorded for this asset yet.</p>
            )}
          </section>

          {accessories.length > 0 && (
            <section aria-labelledby="my-asset-accessories">
              <h4 id="my-asset-accessories" className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Comes with</h4>
              <ul className="flex flex-wrap gap-2">
                {accessories.map((item) => (
                  <li key={item.id} className="text-xs font-medium text-primary bg-base/60 border border-border/60 rounded-lg px-2.5 py-1.5">{item.name}</li>
                ))}
              </ul>
            </section>
          )}

          {isClient && (
            <section aria-labelledby="my-asset-policy" className="rounded-xl border border-warning/30 bg-warning/10 p-4">
              <h4 id="my-asset-policy" className="text-sm font-bold text-primary flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" aria-hidden="true" />
                Loss and damage policy
              </h4>
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-secondary">
                {CLIENT_LAPTOP_POLICY.map((rule) => <li key={rule}>{rule}</li>)}
              </ol>
            </section>
          )}

        </div>
      )}
    </Modal>
  );
}
