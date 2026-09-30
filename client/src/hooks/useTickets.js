import { useState, useCallback, useRef } from 'react';
import { ticketsApi } from '../api/ticketsApi';
import toast from 'react-hot-toast';

export const useTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Filters of the last load, so mutations can reload the same view.
  const lastFiltersRef = useRef(null);

  const fetchTickets = useCallback(async (filters = {}) => {
    lastFiltersRef.current = filters;
    setLoading(true);
    setError(null);
    try {
      const data = await ticketsApi.getAll(filters);
      setTickets(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch tickets');
      toast.error('Could not load tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  // Mutation endpoints return the bare ticket row without the joined fields
  // (human_readable_id, employee_name, asset_name...), and a transfer or
  // status change can move a ticket out of the current view, so reload the
  // list quietly (no skeleton) after every change.
  const refreshTickets = useCallback(async () => {
    if (!lastFiltersRef.current) return;
    try {
      setTickets(await ticketsApi.getAll(lastFiltersRef.current));
    } catch {
      // Keep the optimistic list; the next full load will catch up.
    }
  }, []);

  const mergeTicket = useCallback((updated) => {
    if (!updated) return;
    setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
  }, []);

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
    tickets,
    loading,
    error,
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
