import { useCallback } from 'react';
import { offboardingApi } from '../api/offboardingApi';
import { getQueryData } from '../utils/queryCache';
import { useLazyQuery, errorMessageOf } from './useQuery';
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

const EMPTY = [];
export const OFFBOARDING_KEY = 'offboarding';
const fetchAll = async () => {
  const data = await offboardingApi.getAll();
  return Array.isArray(data) ? data : [];
};

// `initialLoad`: the page loads the list on mount, so a revisit renders its
// cached rows at once.
export const useOffboarding = ({ initialLoad = false } = {}) => {
  // Only reloaded after mutations once this hook has loaded the list (the
  // Employees page uses the hook just to start an exit).
  const list = useLazyQuery(initialLoad ? OFFBOARDING_KEY : null);
  const { run, reload } = list;

  const fetchRequests = useCallback(async () => {
    const hadRows = getQueryData(OFFBOARDING_KEY) !== undefined;
    try {
      await run(OFFBOARDING_KEY, fetchAll);
    } catch {
      if (!hadRows) toast.error('Could not load offboarding requests');
    }
  }, [run]);

  // Mutations return the full request (with items); the list rows carry
  // counts and joined names, so reload the list quietly afterwards.
  const refreshRequests = useCallback(async () => {
    try {
      await reload();
    } catch {
      // Keep the current list; the next full load will catch up.
    }
  }, [reload]);

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
    requests: Array.isArray(list.data) ? list.data : EMPTY,
    loading: list.loading,
    refreshing: list.refreshing,
    error: errorMessageOf(list.error, 'Failed to fetch offboarding requests', { withNetworkMessage: false }),
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
