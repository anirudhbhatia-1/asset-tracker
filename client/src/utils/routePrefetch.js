// Starts downloading a page's code before the user opens it (on hover, focus
// or touch of a link, or when the browser is idle after sign-in), so the
// first visit doesn't wait for it. The same import() calls are used by the
// React.lazy routes in App.jsx, so the browser reuses the downloaded chunk.
const LOADERS = {
  '/': () => Promise.all([
    import('../pages/Dashboard'),
    import('../pages/DirectorDashboard'),
    import('../pages/HrDashboard'),
    import('../pages/EmployeeDashboard'),
  ]),
  '/inventory': () => import('../pages/Inventory'),
  '/inventory/new': () => import('../pages/AddEditAsset'),
  '/assets': () => import('../pages/AssetDetail'),
  '/scanner': () => import('../pages/Scanner'),
  '/employees': () => import('../pages/Employees'),
  '/settings': () => import('../pages/Settings'),
  '/tickets': () => import('../pages/Tickets'),
  '/onboarding': () => import('../pages/Onboarding'),
  '/offboarding': () => import('../pages/Offboarding'),
  '/profile': () => import('../pages/ProfilePage'),
};

const started = new Set();

// Maps a link target (with or without query string) to a known page.
export const loaderKeyFor = (path) => {
  const clean = String(path || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (LOADERS[clean]) return clean;
  if (/^\/(inventory|assets)\/[^/]+(\/edit)?$/.test(clean)) {
    return clean.endsWith('/edit') ? '/inventory/new' : '/assets';
  }
  const top = `/${clean.split('/')[1] || ''}`;
  return LOADERS[top] ? top : null;
};

export const prefetchRoute = (path) => {
  const key = loaderKeyFor(path);
  if (!key || started.has(key)) return;
  started.add(key);
  // A failed prefetch is retried on the real navigation.
  LOADERS[key]().catch(() => started.delete(key));
};

// Warms several pages when the browser has nothing else to do.
export const prefetchWhenIdle = (paths) => {
  const run = () => paths.forEach(prefetchRoute);
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1500);
  }
};
