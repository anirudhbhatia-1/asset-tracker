import { useCallback } from 'react';
import { ticketsApi } from '../api/ticketsApi';
import { getQueryData, queryKey, setQueryData } from '../utils/queryCache';
import { useLazyQuery, errorMessageOf } from './useQuery';
import toast from 'react-hot-toast';

const EMPTY = [];
export const ticketsQueryKey = (filters = {}) => queryKey('tickets', filters);

/**
 * Tickets for the filters of the last fetchTickets() call, from the shared
 * cache when loaded before (then refreshed quietly). `initialFilters`: the
 * filters the page loads first, so a revisit renders its cached rows at once.
 */
export const useTickets = (initialFilters = null) => {
  const query = useLazyQuery(initialFilters ? ticketsQueryKey(initialFilters) : null, { keepPrevious: true });
  const { run, reload, keyRef } = query;

  // Resolves once the list is fresh. A response for filters that are no
  // longer shown never replaces the current rows (each filter set has its
  // own cache entry).
  const fetchTickets = useCallback(async (filters = {}) => {
    const key = ticketsQueryKey(filters);
    const hadRows = getQueryData(key) !== undefined;
    try {
      await run(key, () => ticketsApi.getAll(filters));
    } catch {
      if (!hadRows) toast.error('Could not load tickets');
    }
  }, [run]);

  // Mutation endpoints return the bare ticket row without the joined fields
  // (human_readable_id, employee_name, asset_name...), and a transfer or
  // status change can move a ticket out of the current view, so reload the
  // list quietly (no skeleton) after every change. Other ticket views
  // (another queue, the dashboard) are dropped from the cache by the global
  // after-change invalidation, so they load fresh next time.
  const refreshTickets = useCallback(async () => {
    if (!keyRef.current) return;
    try {
      await reload();
    } catch {
      // Keep the optimistic list; the next full load will catch up.
    }
  }, [keyRef, reload]);

  const mergeTicket = useCallback((updated) => {
    if (!updated) return;
    setQueryData(keyRef.current, prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
  }, [keyRef]);

  const createTicket = useCallback(async (data) => {
    try {
      const newTicket = await ticketsApi.create(data);
      toast.success('Ticket submitted successfully');
      await refreshTickets();
      return newTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to submit ticket';
      toast.error(message);
      throw err;
    }
  }, [refreshTickets]);

  const updateTicket = useCallback(async (id, data) => {
    try {
      const updatedTicket = await ticketsApi.update(id, data);
      mergeTicket(updatedTicket);
      toast.success('Ticket updated successfully');
      refreshTickets();
      return updatedTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update ticket';
      toast.error(message);
      throw err;
    }
  }, [mergeTicket, refreshTickets]);

  const transferTicket = useCallback(async (id, targetAdminType, note) => {
    try {
      const updatedTicket = await ticketsApi.transfer(id, { targetAdminType, note });
      mergeTicket(updatedTicket);
      toast.success('Ticket transferred successfully');
      // Reload rather than guess: a queue view drops the ticket, "All" keeps it.
      refreshTickets();
      return updatedTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to transfer ticket';
      toast.error(message);
      throw err;
    }
  }, [mergeTicket, refreshTickets]);

  const fetchTicketHistory = useCallback(async (id) => {
    try {
      return await ticketsApi.getHistory(id);
    } catch {
      toast.error('Failed to load ticket history');
      return [];
    }
  }, []);

  const confirmCloseTicket = useCallback(async (id) => {
    try {
      const updatedTicket = await ticketsApi.confirmClose(id);
      mergeTicket(updatedTicket);
      toast.success('Ticket resolution confirmed');
      refreshTickets();
      return updatedTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to close ticket';
      toast.error(message);
      throw err;
    }
  }, [mergeTicket, refreshTickets]);

  const reopenTicket = useCallback(async (id, note) => {
    try {
      const updatedTicket = await ticketsApi.reopen(id, note);
      mergeTicket(updatedTicket);
      toast.success('Ticket reopened');
      refreshTickets();
      return updatedTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to reopen ticket';
      toast.error(message);
      throw err;
    }
  }, [mergeTicket, refreshTickets]);

  return {
    tickets: Array.isArray(query.data) ? query.data : EMPTY,
    loading: query.loading,
    refreshing: query.refreshing,
    // Rows of the previous view shown while the new view's first load runs.
    isPlaceholder: query.isPlaceholder,
    error: errorMessageOf(query.error, 'Failed to fetch tickets', { withNetworkMessage: false }),
    fetchTickets,
    refreshTickets,
    createTicket,
    updateTicket,
    transferTicket,
    fetchTicketHistory,
    confirmCloseTicket,
    reopenTicket
  };
};
