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
      setRequests(prev => [newReq, ...prev]);
      toast.success('Onboarding request created');
      return newReq;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create request';
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
      const updatedReq = await onboardingApi.fulfillItem(id, itemId, assetId);
      // Fulfilling an item returns the full updated request, so we can update our local state completely
      setRequests(prev => prev.map(r => r.id === id ? updatedReq : r));
      toast.success('Item fulfilled');
      return updatedReq;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fulfill item';
      toast.error(message);
      throw err;
    }
  };

  // Helper to fetch a single request's details (since the list API doesn't include items)
  const getRequestDetails = async (id) => {
    try {
      return await onboardingApi.getById(id);
    } catch (err) {
      toast.error('Failed to load request details');
      throw err;
    }
  };

  return {
    requests,
    hrMetrics,
    loading,
    error,
    fetchRequests,
    fetchHrMetrics,
    createRequest,
    updateStatus,
    fulfillItem,
    getRequestDetails
  };
};
