import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAssets } from '../api/assetsApi';
import { getCategories } from '../api/categoriesApi';
import { getEmployees } from '../api/employeesApi';
import { getWarrantyStatus } from '../utils/formatters';

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
    const total = assets.length || 1;
    const map = new Map();

    categories.forEach((cat) => {
      if (!cat) return;
      map.set(cat.id, {
        id: cat.id,
        name: cat.name || `Category #${cat.id}`,
        badgeChar: cat.badgeChar || (cat.name ? cat.name.charAt(0) : '?'),
        color: cat.color || '#6366F1',
        filterKey: 'categoryId',
        filterValue: String(cat.id),
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
          filterKey: 'categoryId',
          filterValue: String(catId),
          count: 1,
        });
      } else {
        if (!map.has(0)) {
          map.set(0, {
            id: 0,
            name: 'Uncategorized',
            badgeChar: 'U',
            color: '#64748B',
            filterKey: 'categoryId',
            filterValue: '0',
            count: 0,
          });
        }
        map.get(0).count += 1;
      }
    });

    return Array.from(map.values())
      .filter((item) => item.count > 0)
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
    const locationColors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#06B6D4', '#EC4899'];

    assets.forEach((asset) => {
      const loc = asset.location || 'Unassigned Location';
      if (!map.has(loc)) {
        map.set(loc, { name: loc, count: 0 });
      }
      map.get(loc).count += 1;
    });

    return Array.from(map.values())
      .map((item, index) => ({
        id: item.name,
        name: item.name,
        color: locationColors[index % locationColors.length],
        filterKey: 'location',
        filterValue: item.name,
        count: item.count,
        percentage: Math.round((item.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [data.assets]);

  const breakdownByStatus = useMemo(() => {
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const total = assets.length || 1;

    const statusConfig = [
      { id: 'available', name: 'Available', color: '#10B981', filterKey: 'status', filterValue: 'available' },
      { id: 'in-use', name: 'In Use', color: '#3B82F6', filterKey: 'status', filterValue: 'in-use' },
      { id: 'retired', name: 'Retired', color: '#64748B', filterKey: 'status', filterValue: 'retired' },
    ];

    const counts = { 'available': 0, 'in-use': 0, 'retired': 0 };

    assets.forEach((asset) => {
      const s = (asset.status || '').toLowerCase();
      if (s === 'available') counts['available'] += 1;
      else if (s === 'in-use' || s === 'in_use') counts['in-use'] += 1;
      else if (s === 'retired') counts['retired'] += 1;
    });

    return statusConfig
      .map((config) => {
        const count = counts[config.id] || 0;
        return {
          ...config,
          count,
          percentage: Math.round((count / total) * 100),
        };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [data.assets]);

  const breakdownByWarranty = useMemo(() => {
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const total = assets.length || 1;

    const warrantyConfig = [
      { id: 'in warranty', name: 'In Warranty', color: '#10B981', filterKey: 'warranty', filterValue: 'in-warranty' },
      { id: 'expiring soon', name: 'Expiring Soon', color: '#F59E0B', filterKey: 'warranty', filterValue: 'expiring-soon' },
      { id: 'expired', name: 'Expired', color: '#EF4444', filterKey: 'warranty', filterValue: 'expired' },
      { id: 'no warranty data', name: 'No Warranty Data', color: '#64748B', filterKey: 'warranty', filterValue: 'no-warranty' },
    ];

    const counts = {
      'in warranty': 0,
      'expiring soon': 0,
      'expired': 0,
      'no warranty data': 0,
    };

    assets.forEach((asset) => {
      const ws = getWarrantyStatus(asset.warrantyExpiryDate);
      if (counts[ws] !== undefined) {
        counts[ws] += 1;
      } else {
        counts['no warranty data'] += 1;
      }
    });

    return warrantyConfig
      .map((config) => {
        const count = counts[config.id] || 0;
        return {
          ...config,
          count,
          percentage: Math.round((count / total) * 100),
        };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [data.assets]);

  const lowStockCategories = useMemo(() => {
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const map = new Map();
    assets.forEach(a => {
      const key = a.categoryId ?? 0;
      const name = a.categoryName || 'Uncategorized';
      if (!map.has(key)) map.set(key, { name, available: 0, total: 0 });
      map.get(key).total += 1;
      if (a.status === 'available') map.get(key).available += 1;
    });
    return Array.from(map.values()).filter(c => c.available <= 2).sort((a, b) => a.available - b.available);
  }, [data.assets]);

  return {
    metrics,
    breakdown: Array.isArray(breakdown) ? breakdown : [],
    breakdownByLocation,
    breakdownByStatus,
    breakdownByWarranty,
    lowStockCategories,
    categories: Array.isArray(data.categories) ? data.categories : [],
    employees: Array.isArray(data.employees) ? data.employees : [],
    loading,
    error,
    refresh: fetchMetrics,
  };
}

