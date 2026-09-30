import { useState, useCallback } from 'react';
import { onboardingApi } from '../api/onboardingApi';
import toast from 'react-hot-toast';

export const useOnboarding = () => {
  const [requests, setRequests] = useState([]);
  const [hrMetrics, setHrMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onboardingApi.getAll();
      setRequests(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch onboarding requests');
      toast.error('Could not load onboarding requests');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create/update/fulfil return a request without the list's joined fields
  // (items_summary, requested_by_email, linked_employee_name) — fulfil even
  // returns just the item — so reload the list quietly after those.
  const refreshRequests = useCallback(async () => {
    try {
      setRequests(await onboardingApi.getAll());
    } catch {
      // Keep the current list; the next full load will catch up.
    }
  }, []);

  const fetchHrMetrics = useCallback(async () => {
    try {
      const data = await onboardingApi.getHrMetrics();
      setHrMetrics(data);
    } catch (err) {
      console.error('Failed to load HR metrics', err);
    }
  }, []);

  const createRequest = async (data) => {
    try {
      const newReq = await onboardingApi.create(data);
      toast.success('Onboarding request created');
      await refreshRequests();
      return newReq;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create request';
      toast.error(message);
      throw err;
    }
  };

  const updateRequestDetails = async (id, data) => {
    try {
      const updatedReq = await onboardingApi.updateRequest(id, data);
      toast.success('Onboarding request updated');
      await refreshRequests();
      return updatedReq;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update request';
      toast.error(message);
      throw err;
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const updatedReq = await onboardingApi.updateStatus(id, status);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: updatedReq.status, updated_at: updatedReq.updated_at } : r));
      toast.success('Status updated');
      return updatedReq;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update status';
      toast.error(message);
      throw err;
    }
  };

  const fulfillItem = async (id, itemId, assetId) => {
    try {
      // The API answers with the updated item row, not the whole request.
      const updatedItem = await onboardingApi.fulfillItem(id, itemId, assetId);
      toast.success('Item fulfilled');
      refreshRequests();
      return updatedItem;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fulfill item';
      toast.error(message);
      throw err;
    }
  };

  // Helper to fetch a single request's details (since the list API doesn't include items)
  const getRequestDetails = useCallback(async (id) => {
    try {
      return await onboardingApi.getById(id);
    } catch (err) {
      toast.error('Failed to load request details');
      throw err;
    }
  }, []);

  return {
    requests,
    hrMetrics,
    loading,
    error,
    fetchRequests,
    refreshRequests,
    fetchHrMetrics,
    createRequest,
    updateRequestDetails,
    updateStatus,
    fulfillItem,
    getRequestDetails
  };
};
