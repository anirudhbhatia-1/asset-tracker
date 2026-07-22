import { useState, useEffect, useCallback } from 'react';
import { getCategories } from '../api/categoriesApi';

export default function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCategoriesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCategories();
      setCategories(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategoriesData();
  }, [fetchCategoriesData]);

  return { categories, loading, error, refresh: fetchCategoriesData };
}
