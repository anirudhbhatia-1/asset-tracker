import { useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { stockApi } from '../api/stockApi';

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

/**
 * Bulk items (counted, no serial numbers). The list is loaded on demand with
 * fetchItems(); mutations toast once here and resolve to the updated item
 * (with holders and history), so callers only handle inline validation.
 */
export const useStock = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Only reload the list after a change when this hook has loaded it (the
  // employee drawer uses the hook just to take items back).
  const listLoadedRef = useRef(false);

  const fetchItems = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await stockApi.getAll(filters);
      setItems(Array.isArray(data) ? data : []);
      listLoadedRef.current = true;
    } catch (err) {
      setError(errorMessage(err, 'Failed to load bulk items'));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshItems = useCallback(async () => {
    if (!listLoadedRef.current) return;
    try {
      const data = await stockApi.getAll();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      // Keep the current list; the next full load will catch up.
    }
  }, []);

  const mutate = useCallback(async (call, success, failure) => {
    try {
      const result = await call();
      toast.success(success);
      refreshItems();
      return result;
    } catch (err) {
      toast.error(errorMessage(err, failure));
      throw err;
    }
  }, [refreshItems]);

  const getItem = useCallback(async (id) => {
    try {
      return await stockApi.getById(id);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load the bulk item'));
      throw err;
    }
  }, []);

  const createItem = useCallback((data) => mutate(
    () => stockApi.create(data), `"${data.name}" added`, 'Failed to add the bulk item',
  ), [mutate]);

  const updateItem = useCallback((id, data) => mutate(
    () => stockApi.update(id, data), 'Bulk item updated', 'Failed to update the bulk item',
  ), [mutate]);

  const adjustStock = useCallback((id, data) => mutate(
    () => stockApi.adjust(id, data),
    data.change > 0 ? `Added ${data.change} to stock` : `Removed ${Math.abs(data.change)} from stock`,
    'Failed to update stock',
  ), [mutate]);

  const assignStock = useCallback((id, data, employeeName) => mutate(
    () => stockApi.assign(id, data),
    employeeName ? `Gave ${data.quantity} to ${employeeName}` : 'Assigned',
    'Failed to assign',
  ), [mutate]);

  const returnStock = useCallback((id, data) => mutate(
    () => stockApi.returnStock(id, data), `${data.quantity} returned to stock`, 'Failed to return',
  ), [mutate]);

  const writeOffStock = useCallback((id, data) => mutate(
    () => stockApi.writeOff(id, data), `${data.quantity} written off`, 'Failed to write off',
  ), [mutate]);

  const deleteItem = useCallback((id) => mutate(
    () => stockApi.remove(id), 'Bulk item removed', 'Failed to remove the bulk item',
  ), [mutate]);

  return {
    items,
    loading,
    error,
    fetchItems,
    refreshItems,
    getItem,
    createItem,
    updateItem,
    adjustStock,
    assignStock,
    returnStock,
    writeOffStock,
    deleteItem,
  };
};

/**
 * Bulk items one person holds. `employeeId` = 'me' loads the signed-in
 * user's own (GET /stock/mine). Load errors are kept quiet: the section is
 * simply hidden or shows a short message.
 */
export const useStockHoldings = (employeeId, enabled = true) => {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // A late response for a previously shown employee is ignored.
  const latestRequest = useRef(0);
  const fetchHoldings = useCallback(async () => {
    if (!employeeId) return;
    const requestNumber = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const data = employeeId === 'me' ? await stockApi.getMine() : await stockApi.getHoldings(employeeId);
      if (requestNumber === latestRequest.current) setHoldings(Array.isArray(data) ? data : []);
    } catch (err) {
      if (requestNumber === latestRequest.current) setError(errorMessage(err, 'Failed to load bulk items'));
    } finally {
      if (requestNumber === latestRequest.current) setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (!enabled || !employeeId) return;
    setHoldings([]);
    fetchHoldings();
  }, [enabled, employeeId, fetchHoldings]);

  return { holdings, loading, error, refresh: fetchHoldings };
};

export default useStock;
