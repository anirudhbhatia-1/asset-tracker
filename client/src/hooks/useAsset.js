import { useState, useEffect, useCallback } from 'react';
import {
  getAsset,
  updateAsset as updateAssetApi,
  assignAssetApi,
  returnAssetApi,
  retireAssetApi,
  deleteAssetApi,
} from '../api/assetsApi';
import toast from 'react-hot-toast';

export default function useAsset(id) {
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssetData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAsset(id);
      setAsset(res.data?.data || res.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load asset details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAssetData();
  }, [fetchAssetData]);

  const updateAssetData = async (data) => {
    try {
      const res = await updateAssetApi(id, data);
      const updated = res.data?.data || res.data;
      setAsset(updated);
      toast.success('Asset details updated');
      return updated;
    } catch (err) {
      toast.error(err.message || 'Failed to update notes');
      throw err;
    }
  };

  const assignToEmployee = async (employeeId, assignedDate, note) => {
    try {
      const res = await assignAssetApi(id, { employeeId, assignedDate, note });
      const updated = res.data?.data || res.data;
      setAsset(updated);
      toast.success('Asset assigned successfully');
      return updated;
    } catch (err) {
      toast.error(err.message || 'Failed to assign asset');
      throw err;
    }
  };

  const returnToStock = async (note) => {
    try {
      const res = await returnAssetApi(id, note);
      const updated = res.data?.data || res.data;
      setAsset(updated);
      toast.success('Asset returned to stock');
      return updated;
    } catch (err) {
      toast.error(err.message || 'Failed to return asset');
      throw err;
    }
  };

  const retireAsset = async (note) => {
    try {
      const res = await retireAssetApi(id, note);
      const updated = res.data?.data || res.data;
      setAsset(updated);
      toast.success('Asset decommissioned and retired');
      return updated;
    } catch (err) {
      toast.error(err.message || 'Failed to retire asset');
      throw err;
    }
  };

  const deleteAsset = async () => {
    try {
      await deleteAssetApi(id);
      toast.success('Asset permanently deleted');
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete asset');
      throw err;
    }
  };

  return {
    asset,
    loading,
    error,
    refresh: fetchAssetData,
    updateAssetData,
    assignToEmployee,
    returnToStock,
    retireAsset,
    deleteAsset,
  };
}
