import { useState, useEffect, useCallback } from 'react';
import { getCategories, createCategory, deleteCategoryApi } from '../api/categoriesApi';
import toast from 'react-hot-toast';

export default function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCategoriesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCategories();
      setCategories(res.data?.data || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategoriesData();
  }, [fetchCategoriesData]);

  const addCategory = async (payload) => {
    try {
      const res = await createCategory(payload);
      toast.success(`Category "${payload.name}" created successfully`);
      await fetchCategoriesData();
      return { success: true, data: res.data };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create category';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const removeCategory = async (id, name) => {
    try {
      await deleteCategoryApi(id);
      toast.success(`Category "${name}" deleted`);
      await fetchCategoriesData();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Cannot delete category in use';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  return { 
    categories: Array.isArray(categories) ? categories : [], 
    loading, 
    error, 
    refresh: fetchCategoriesData,
    addCategory,
    removeCategory
  };
}
