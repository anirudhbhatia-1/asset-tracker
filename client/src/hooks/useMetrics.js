import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAssets } from '../api/assetsApi';
import { getCategories } from '../api/categoriesApi';
import { getEmployees } from '../api/employeesApi';

export default function useMetrics() {
  const [data, setData] = useState({
    assets: [],
    categories: [],
    employees: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetsRes, categoriesRes, employeesRes] = await Promise.all([
        getAssets(),
        getCategories(),
        getEmployees(),
      ]);

      setData({
        assets: assetsRes.data || [],
        categories: categoriesRes.data || [],
        employees: employeesRes.data || [],
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const metrics = useMemo(() => {
    const assets = data.assets;
    const total = assets.length;
    const inUse = assets.filter((a) => a.status === 'in-use').length;
    const available = assets.filter((a) => a.status === 'available').length;
    const retired = assets.filter((a) => a.status === 'retired').length;

    return { total, inUse, available, retired };
  }, [data.assets]);

  const breakdown = useMemo(() => {
    const assets = data.assets;
    const total = assets.length || 1; // prevent div by zero
    const map = new Map();

    // Initialize with all categories so even 0-count categories show or we sort neatly
    data.categories.forEach((cat) => {
      map.set(cat.id, {
        id: cat.id,
        name: cat.name,
        badgeChar: cat.badgeChar || cat.name.charAt(0),
        color: cat.color || '#6366F1',
        count: 0,
      });
    });

    assets.forEach((asset) => {
      const catId = asset.categoryId;
      if (catId && map.has(catId)) {
        map.get(catId).count += 1;
      } else if (catId) {
        map.set(catId, {
          id: catId,
          name: asset.categoryName || 'Other',
          badgeChar: asset.categoryBadgeChar || '?',
          color: asset.categoryColor || '#64748B',
          count: 1,
        });
      } else {
        if (!map.has(0)) {
          map.set(0, {
            id: 0,
            name: 'Uncategorized',
            badgeChar: 'U',
            color: '#64748B',
            count: 0,
          });
        }
        map.get(0).count += 1;
      }
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: Math.round((item.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [data.assets, data.categories]);

  return {
    metrics,
    breakdown,
    categories: data.categories,
    employees: data.employees,
    loading,
    error,
    refresh: fetchMetrics,
  };
}
