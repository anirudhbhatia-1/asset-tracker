import { useState, useCallback } from 'react';
import { ticketsApi } from '../api/ticketsApi';
import toast from 'react-hot-toast';

export const useTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ticketsApi.getAll();
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

  return {
    tickets,
    loading,
    error,
    fetchTickets,
    createTicket,
    updateTicket
  };
};
