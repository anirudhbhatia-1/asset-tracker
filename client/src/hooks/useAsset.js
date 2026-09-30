import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // Id whose data is on screen; reloading it is a background refresh that
  // keeps the page up instead of swapping back to the skeleton.
  const loadedIdRef = useRef(null);

  const fetchAssetData = useCallback(async () => {
    if (!id) return;
    const isRefresh = loadedIdRef.current === id;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await getAsset(id);
      setAsset(res.data?.data || res.data || null);
      setError(null);
      loadedIdRef.current = id;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to load asset details';
      if (isRefresh) toast.error(message);
      else setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      toast.error(err.response?.data?.message || err.message || 'Failed to update asset');
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
      toast.error(err.response?.data?.message || err.message || 'Failed to assign asset');
      throw err;
    }
  };

  const returnToStock = async (note) => {
    try {
      const res = await returnAssetApi(id, note);
      const updated = res.data?.data || res.data;
      setAsset(updated);
      toast.success((updated?.assetType ?? asset?.assetType) === 'client' ? 'Returned to client' : 'Asset returned to stock');
      return updated;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to return asset');
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
      toast.error(err.response?.data?.message || err.message || 'Failed to retire asset');
      throw err;
    }
  };

  const deleteAsset = async () => {
    try {
      await deleteAssetApi(id);
      toast.success('Asset permanently deleted');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete asset');
      throw err;
    }
  };

  return {
    asset,
    loading,
    refreshing,
    error,
    refresh: fetchAssetData,
    updateAssetData,
    assignToEmployee,
    returnToStock,
    retireAsset,
    deleteAsset,
  };
}
