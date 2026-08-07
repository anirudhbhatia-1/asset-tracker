import React, { useState, useEffect } from 'react';
import Badge from '../ui/Badge';
import StatusPill from '../ui/StatusPill';
import Button from '../ui/Button';
import { Copy, Check, Edit2, MapPin, DollarSign, Calendar, ShieldCheck, Building2, Briefcase, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { getWarrantyStatus, formatDate, getWarrantyDaysLeft } from '../../utils/formatters';
import useLocations from '../../hooks/useLocations';
import QrTagModal from './QrTagModal';

export default function SpecsProfile({ asset, onUpdateAssetData, readOnly }) {
  const { locations } = useLocations(isEditing);
  const [isEditing, setIsEditing] = useState(false);
  const [assetType, setAssetType] = useState(asset?.assetType || 'company');
  const [locationName, setLocationName] = useState(asset?.location || '');
  const [addressValue, setAddressValue] = useState(asset?.address || '');
  const [notesValue, setNotesValue] = useState(asset?.notes || '');
  const [warrantyValue, setWarrantyValue] = useState(asset?.warrantyExpiryDate || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    if (asset) {
      setAssetType(asset.assetType || 'company');
      setLocationName(asset.location || '');
      setAddressValue(asset.address || '');
      setNotesValue(asset.notes || '');
      setWarrantyValue(asset.warrantyExpiryDate || '');
    }
  }, [asset]);

  const formattedCost = formatCostCents(asset?.costCents);

  if (!asset) return null;

  const handleCopySerial = () => {
    if (!asset.serialNumber) return;
    navigator.clipboard.writeText(asset.serialNumber);
    setCopied(true);
    toast.success('Serial number copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLocationSelect = (e) => {
    const selectedLocName = e.target.value;
    setLocationName(selectedLocName);
    const foundLoc = locations.find((l) => l.name === selectedLocName);
    if (foundLoc) {
      setAddressValue(foundLoc.address || '');
    }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await onUpdateAssetData({
        assetType,
        location: locationName.trim() || null,
        address: addressValue.trim() || null,
        notes: notesValue.trim() || null,
        warrantyExpiryDate: warrantyValue || null,
      });
      setIsEditing(false);
    } catch (err) {
      // Error toast already handled inside hook
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setAssetType(asset.assetType || 'company');
    setLocationName(asset.location || '');
    setAddressValue(asset.address || '');
    setNotesValue(asset.notes || '');
    setWarrantyValue(asset.warrantyExpiryDate || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-surface rounded-xl border border-border/80 p-6 shadow-sm space-y-6">
      {/* Header: Name, Category, Asset Type, Status, Edit Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-start gap-3.5 min-w-0">
          <Badge
            badgeChar={asset.categoryBadgeChar || asset.categoryName || '?'}
            color={asset.categoryColor}
            title={asset.categoryName || 'Category'}
            className="!w-10 !h-10 !text-sm mt-0.5"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-primary tracking-tight truncate">{asset.name}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-raised/80 text-secondary border border-border/70">
                {asset.categoryName || 'Uncategorized'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                  asset.assetType === 'client'
                    ? 'bg-accent/10 text-accent border-accent/20'
                    : 'bg-surface text-secondary border-border'
                }`}
              >
                {asset.assetType === 'client' ? 'Client Asset' : 'Company Asset'}
              </span>
            </div>
            {asset.model && <p className="text-sm text-secondary mt-1">Model: {asset.model}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
          <StatusPill status={asset.status} />
          {asset.serialNumber && (
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-raised hover:bg-raised/80 text-secondary hover:text-primary border border-border rounded-lg transition-colors cursor-pointer"
              title="Generate & Print QR Asset Tag"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Tag</span>
            </button>
          )}
          {!isEditing && asset.status !== 'retired' && !readOnly && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-raised hover:bg-raised/80 text-accent border border-accent/20 rounded-lg transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Spec View / Edit */}
      {isEditing ? (
        <div className="bg-base/40 p-5 rounded-xl border border-accent/20 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-accent" />
              <span>Edit Asset Details</span>
            </h3>
            <span className="text-xs text-secondary">Update asset type, location, and operational notes</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Asset Type (Client vs Company) */}
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                Asset Type Tag
              </label>
              <div className="flex bg-surface border border-border rounded-lg p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setAssetType('company')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    assetType === 'company'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Company Asset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAssetType('client')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    assetType === 'client'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Client Asset</span>
                </button>
              </div>
            </div>

            {/* Office Location */}
            <div>
              <label htmlFor="edit-location-select" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                Office Location
              </label>
              <select
                id="edit-location-select"
                value={locationName}
                onChange={handleLocationSelect}
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              >
                <option value="">Select Office Location...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Address Details */}
            <div className="sm:col-span-2">
              <label htmlFor="edit-address-input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                Full Address / Specific Room
              </label>
              <input
                id="edit-address-input"
                type="text"
                value={addressValue}
                onChange={(e) => setAddressValue(e.target.value)}
                placeholder="Building, street address, or room number..."
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Warranty Expiry Date */}
            <div>
              <label htmlFor="edit-warranty-input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                Warranty Expiry Date
              </label>
              <input
                id="edit-warranty-input"
                type="date"
                value={warrantyValue}
                onChange={(e) => setWarrantyValue(e.target.value)}
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              />
            </div>

            {/* Operational & Audit Notes */}
            <div className="sm:col-span-2">
              <label htmlFor="edit-notes-input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                Operational & Audit Notes
              </label>
              <textarea
                id="edit-notes-input"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Add tracking notes, maintenance history, or special considerations..."
                rows={3}
                className="w-full rounded-lg bg-surface border border-border p-3 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveDetails} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      ) : (
        /* Grid of Spec Attributes in View Mode */
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
            <div className="min-w-0">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Office Location</span>
              <span className="text-primary font-medium truncate block">
                {asset.address ? `${asset.location || 'Location'} (${asset.address})` : (asset.location || 'Not specified')}
              </span>
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
              <span className="text-primary font-mono font-medium">{formatDate(asset.purchaseDate)}</span>
            </div>
          </div>

          {/* Warranty Status */}
          <div className="bg-base/60 p-3.5 rounded-xl border border-border/60 flex items-center justify-between gap-3 sm:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-secondary shrink-0">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Warranty Expiry</span>
                <span className="text-primary font-mono font-medium">{formatDate(asset.warrantyExpiryDate)}</span>
                {getWarrantyDaysLeft(asset.warrantyExpiryDate) && (
                  <span className={`text-[10px] mt-0.5 block font-medium ${
                    getWarrantyStatus(asset.warrantyExpiryDate) === 'expired'
                      ? 'text-danger'
                      : getWarrantyStatus(asset.warrantyExpiryDate) === 'expiring soon'
                      ? 'text-warning'
                      : 'text-success'
                  }`}>
                    {getWarrantyDaysLeft(asset.warrantyExpiryDate)}
                  </span>
                )}
              </div>
            </div>
            <StatusPill status={getWarrantyStatus(asset.warrantyExpiryDate)} />
          </div>

          {/* Operational Notes */}
          <div className="sm:col-span-2 pt-2 border-t border-border/60">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-2">
              Operational & Audit Notes
            </span>
            <div className="bg-base/40 p-3.5 rounded-xl border border-border/40 text-sm text-secondary min-h-[64px] whitespace-pre-wrap">
              {asset.notes || <span className="text-secondary italic">No notes recorded for this asset yet.</span>}
            </div>
          </div>
        </div>
      )}

      <QrTagModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        asset={asset}
      />
    </div>
  );
}

function formatCostCents(cents = 0) {
  if (cents === null || cents === undefined || isNaN(cents)) return '$0.00';
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars);
}

