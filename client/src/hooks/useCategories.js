import { getCategories, createCategory, deleteCategoryApi } from '../api/categoriesApi';
import { invalidateQueries } from '../utils/queryCache';
import useQuery, { errorMessageOf } from './useQuery';
import { listOf } from './useAssets';
import toast from 'react-hot-toast';

const EMPTY = [];
export const CATEGORIES_KEY = 'categories';
export const fetchCategoriesList = () => getCategories().then(listOf);
// Shared by Inventory, the dashboard and several forms: loaded once and
// reused; any change to categories reloads it (see utils/queryCache).
export const LOOKUP_STALE_TIME = 5 * 60 * 1000;

export default function useCategories() {
  const { data, loading, refreshing, error, refetch } = useQuery(CATEGORIES_KEY, fetchCategoriesList, { staleTime: LOOKUP_STALE_TIME });

  const addCategory = async (payload) => {
    try {
      const res = await createCategory(payload);
      toast.success(`Category "${payload.name}" created successfully`);
      await invalidateQueries(CATEGORIES_KEY);
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
      await invalidateQueries(CATEGORIES_KEY);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Cannot delete category in use';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  return {
    categories: Array.isArray(data) ? data : EMPTY,
    loading,
    refreshing,
    error: errorMessageOf(error, 'Failed to load categories'),
    refresh: refetch,
    addCategory,
    removeCategory
  };
}
