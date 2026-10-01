import { useState, useCallback, useRef } from 'react';
import { offboardingApi } from '../api/offboardingApi';
import toast from 'react-hot-toast';

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

/**
 * The employee already has an open exit: { requestId } of that request, or
 * null for any other error. StartOffboardingModal offers to open it instead.
 */
export const getExistingOffboardingId = (err) => {
  if (err?.response?.status !== 409) return null;
  const id = err.response.data?.details?.requestId;
  return id ? id : null;
};

export const useOffboarding = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Only refresh the list after mutations when this hook has loaded it
  // (the Employees page uses the hook just to start an exit).
  const listLoadedRef = useRef(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await offboardingApi.getAll();
      setRequests(Array.isArray(data) ? data : []);
      listLoadedRef.current = true;
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch offboarding requests'));
      toast.error('Could not load offboarding requests');
    } finally {
      setLoading(false);
    }
  }, []);

  // Mutations return the full request (with items); the list rows carry
  // counts and joined names, so reload the list quietly afterwards.
  const refreshRequests = useCallback(async () => {
    if (!listLoadedRef.current) return;
    try {
      const data = await offboardingApi.getAll();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      // Keep the current list; the next full load will catch up.
    }
  }, []);

  const createRequest = useCallback(async (data) => {
    try {
      const created = await offboardingApi.create(data);
      toast.success('Offboarding started');
      refreshRequests();
      return created;
    } catch (err) {
      // An open exit already exists: the modal explains and offers to open
      // it, so no toast here.
      if (!getExistingOffboardingId(err)) {
        toast.error(errorMessage(err, 'Failed to start offboarding'));
      }
      throw err;
    }
  }, [refreshRequests]);

  const updateRequest = useCallback(async (id, data) => {
    try {
      const updated = await offboardingApi.updateRequest(id, data);
      toast.success('Offboarding updated');
      refreshRequests();
      return updated;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update offboarding'));
      throw err;
    }
  }, [refreshRequests]);

  const resolveItem = useCallback(async (id, itemId, data) => {
    try {
      const updated = await offboardingApi.resolveItem(id, itemId, data);
      toast.success(data?.outcome === 'missing' ? 'Asset reported missing' : 'Asset marked returned');
      refreshRequests();
      return updated;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update the checklist'));
      throw err;
    }
  }, [refreshRequests]);

  const completeRequest = useCallback(async (id, data) => {
    try {
      const updated = await offboardingApi.complete(id, data);
      toast.success('Offboarding completed');
      refreshRequests();
      return updated;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to complete offboarding'));
      throw err;
    }
  }, [refreshRequests]);

  const cancelRequest = useCallback(async (id) => {
    try {
      const updated = await offboardingApi.cancel(id);
      toast.success('Offboarding cancelled');
      refreshRequests();
      return updated;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to cancel offboarding'));
      throw err;
    }
  }, [refreshRequests]);

  // Single request with its checklist (the list API doesn't include items).
  const getRequestDetails = useCallback(async (id) => {
    try {
      return await offboardingApi.getById(id);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load offboarding details'));
      throw err;
    }
  }, []);

  return {
    requests,
    loading,
    error,
    fetchRequests,
    refreshRequests,
    createRequest,
    updateRequest,
    resolveItem,
    completeRequest,
    cancelRequest,
    getRequestDetails,
  };
};
