import { useState, useCallback } from 'react';
import { ticketsApi } from '../api/ticketsApi';
import toast from 'react-hot-toast';

export const useTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTickets = useCallback(async (filters = {}) => {
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

  const createTicket = async (data) => {
    try {
      const newTicket = await ticketsApi.create(data);
      setTickets(prev => [newTicket, ...prev]);
      toast.success('Ticket submitted successfully');
      return newTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to submit ticket';
      toast.error(message);
      throw err;
    }
  };

  const updateTicket = async (id, data) => {
    try {
      const updatedTicket = await ticketsApi.update(id, data);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updatedTicket } : t));
      toast.success('Ticket updated successfully');
      return updatedTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update ticket';
      toast.error(message);
      throw err;
    }
  };

  const transferTicket = async (id, targetAdminType, note) => {
    try {
      const updatedTicket = await ticketsApi.transfer(id, { targetAdminType, note });
      setTickets(prev => prev.filter(t => t.id !== id)); // Remove from current queue assuming it's transferred out
      toast.success('Ticket transferred successfully');
      return updatedTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to transfer ticket';
      toast.error(message);
      throw err;
    }
  };

  const fetchTicketHistory = async (id) => {
    try {
      const history = await ticketsApi.getHistory(id);
      return history;
    } catch (err) {
      toast.error('Failed to load ticket history');
      return [];
    }
  };

  const confirmCloseTicket = async (id) => {
    try {
      const updatedTicket = await ticketsApi.confirmClose(id);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updatedTicket } : t));
      toast.success('Ticket resolution confirmed');
      return updatedTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to close ticket';
      toast.error(message);
      throw err;
    }
  };

  const reopenTicket = async (id, note) => {
    try {
      const updatedTicket = await ticketsApi.reopen(id, note);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updatedTicket } : t));
      toast.success('Ticket reopened');
      return updatedTicket;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to reopen ticket';
      toast.error(message);
      throw err;
    }
  };

  return {
    tickets,
    loading,
    error,
    fetchTickets,
    createTicket,
    updateTicket,
    transferTicket,
    fetchTicketHistory,
    confirmCloseTicket,
    reopenTicket
  };
};
