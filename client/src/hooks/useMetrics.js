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
        assets: assetsRes.data?.data || (Array.isArray(assetsRes.data) ? assetsRes.data : []),
        categories: categoriesRes.data?.data || (Array.isArray(categoriesRes.data) ? categoriesRes.data : []),
        employees: employeesRes.data?.data || (Array.isArray(employeesRes.data) ? employeesRes.data : []),
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
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const total = assets.length;
    const inUse = assets.filter((a) => a.status === 'in-use').length;
    const available = assets.filter((a) => a.status === 'available').length;
    const retired = assets.filter((a) => a.status === 'retired').length;

    return { total, inUse, available, retired };
  }, [data.assets]);

  const breakdown = useMemo(() => {
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const total = assets.length || 1; // prevent div by zero
    const map = new Map();

    // Initialize with all categories so even 0-count categories show or we sort neatly
    categories.forEach((cat) => {
      if (!cat) return;
      map.set(cat.id, {
        id: cat.id,
        name: cat.name || `Category #${cat.id}`,
        badgeChar: cat.badgeChar || (cat.name ? cat.name.charAt(0) : '?'),
        color: cat.color || '#6366F1',
        count: 0,
      });
    });

    assets.forEach((asset) => {
      const catId = asset.categoryId;
      if (catId !== undefined && catId !== null && map.has(catId)) {
        map.get(catId).count += 1;
      } else if (catId !== undefined && catId !== null) {
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

  const breakdownByLocation = useMemo(() => {
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const total = assets.length || 1;
    const map = new Map();

    assets.forEach((asset) => {
      const loc = asset.location || 'Unassigned Location';
      if (!map.has(loc)) {
        map.set(loc, { name: loc, count: 0 });
      }
      map.get(loc).count += 1;
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: Math.round((item.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [data.assets]);

  const breakdownByStatus = useMemo(() => {
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const total = assets.length || 1;
    const map = new Map();

    assets.forEach((asset) => {
      const status = asset.status || 'unknown';
      if (!map.has(status)) {
        map.set(status, { name: status.charAt(0).toUpperCase() + status.slice(1), count: 0, raw: status });
      }
      map.get(status).count += 1;
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: Math.round((item.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [data.assets]);

  return {
    metrics,
    breakdown: Array.isArray(breakdown) ? breakdown : [],
    breakdownByLocation,
    breakdownByStatus,
    categories: Array.isArray(data.categories) ? data.categories : [],
    employees: Array.isArray(data.employees) ? data.employees : [],
    loading,
    error,
    refresh: fetchMetrics,
  };
}
