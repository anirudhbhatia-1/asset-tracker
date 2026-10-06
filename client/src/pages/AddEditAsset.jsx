import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BulkCsvUpload from '../components/forms/BulkCsvUpload';
import useAsset from '../hooks/useAsset';
import AddAssetForm from '../components/forms/AddAssetForm';
import { updateAsset as updateAssetApi } from '../api/assetsApi';
import { SkeletonCard } from '../components/ui/Skeleton';
import PageHeader from '../components/ui/PageHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import { ArrowLeft, PlusCircle, Edit3, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddEditAsset() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canBulkUpload = !isEdit && hasPermission('assets:import');
  const [mode, setMode] = useState('single');

  const { asset, loading, error } = useAsset(isEdit ? id : null);

  // Errors propagate to AddAssetForm, which shows the failure toast.
  const handleSaveEdit = async (updatedPayload) => {
    const res = await updateAssetApi(id, updatedPayload);
    toast.success('Asset details updated successfully');
    navigate(`/inventory/${id}`);
    return res.data?.data || res.data;
  };

  if (isEdit && loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
        <div className="h-6 w-48 bg-surface rounded" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isEdit && (error || !asset)) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-surface border border-border rounded-2xl p-8">
          <h3 className="text-lg font-bold text-primary">Asset Not Found</h3>
          <p className="text-sm text-secondary mt-1">We couldn't load the asset to edit.</p>
          <Link
            to="/inventory"
            className="inline-block mt-4 px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-semibold"
          >
            Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header & Navigation */}
      <PageHeader
        icon={isEdit ? Edit3 : PlusCircle}
        title={isEdit ? `Edit Asset: ${asset?.name || `#${id}`}` : 'Register New Hardware Asset'}
        subtitle={isEdit
          ? 'Modify asset metadata, specifications, and physical location.'
          : 'Add a new hardware device with unique serial verification and optional immediate employee allocation.'}
        leading={
          <Link
            aria-label="Go back"
            to={isEdit ? `/inventory/${id}` : '/inventory'}
            className="shrink-0 p-2 rounded-xl bg-surface border border-border text-secondary hover:text-primary hover:bg-raised/60 transition-colors shadow-sm cursor-pointer"
            title="Go back"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
        }
      />

      {canBulkUpload && (
        <div>
          <SegmentedControl
            label="How to add assets"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single', label: 'Single asset', icon: PlusCircle },
              { value: 'bulk', label: 'Bulk upload (CSV)', icon: FileSpreadsheet },
            ]}
          />
        </div>
      )}

      {canBulkUpload && mode === 'bulk' ? (
        <BulkCsvUpload />
      ) : (
        <AddAssetForm
          initialData={isEdit ? asset : null}
          isEdit={isEdit}
          onSaveSuccess={isEdit ? handleSaveEdit : undefined}
        />
      )}
    </div>
  );
}
