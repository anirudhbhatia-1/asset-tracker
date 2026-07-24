import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import useAsset from '../hooks/useAsset';
import AddAssetForm from '../components/forms/AddAssetForm';
import { updateAsset as updateAssetApi } from '../api/assetsApi';
import { SkeletonCard } from '../components/ui/Skeleton';
import { ArrowLeft, PlusCircle, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddEditAsset() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { asset, loading, error } = useAsset(isEdit ? id : null);

  const handleSaveEdit = async (updatedPayload) => {
    try {
      const res = await updateAssetApi(id, updatedPayload);
      toast.success('Asset details updated successfully');
      navigate(`/inventory/${id}`);
      return res.data?.data || res.data;
    } catch (err) {
      toast.error(err.message || 'Failed to update asset');
      throw err;
    }
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
            className="inline-block mt-4 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold"
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
      <div className="flex items-center gap-4">
        <Link
          to={isEdit ? `/inventory/${id}` : '/inventory'}
          className="p-2 rounded-xl bg-surface border border-border text-secondary hover:text-primary hover:bg-raised/60 transition-colors shadow-sm cursor-pointer"
          title="Go back"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight flex items-center gap-2.5">
            {isEdit ? <Edit3 className="w-6 h-6 text-accent" /> : <PlusCircle className="w-6 h-6 text-accent" />}
            <span>{isEdit ? `Edit Asset: ${asset?.name || `#${id}`}` : 'Register New Hardware Asset'}</span>
          </h1>
          <p className="text-sm text-secondary mt-1">
            {isEdit
              ? 'Modify asset metadata, specifications, and physical location.'
              : 'Add a new hardware device with unique serial verification and optional immediate employee allocation.'}
          </p>
        </div>
      </div>

      {/* Form Component */}
      <AddAssetForm
        initialData={isEdit ? asset : null}
        isEdit={isEdit}
        onSaveSuccess={isEdit ? handleSaveEdit : undefined}
      />
    </div>
  );
}
