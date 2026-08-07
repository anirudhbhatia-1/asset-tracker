# AssetTrack Migration Notes — Permission Key Audit (Phase 0 Baseline)

## Audit Findings for `inventory:*` Key Replacements

The following exact occurrences of `inventory:*` permission key strings were audited across the codebase and must be systematically migrated to `assets:*`:

### Client Layer
- `client/src/App.jsx`
  - L27: `hasPermission('inventory:read')` → `hasPermission('assets:read')`
  - L76: `requiredPermission="inventory:create"` → `requiredPermission="assets:create"`
  - L80: `requiredPermission="inventory:read"` → `requiredPermission="assets:read"`
  - L86: `requiredPermission="inventory:update"` → `requiredPermission="assets:update"`
- `client/src/components/layout/Sidebar.jsx`
  - L16: `permissionKey: 'inventory:read'` → `permissionKey: 'assets:read'`
- `client/src/components/layout/TopBar.jsx`
  - L136: `hasPermission('inventory:create')` → `hasPermission('assets:create')`
  - L147: `hasPermission('inventory:create')` → `hasPermission('assets:create')`
- `client/src/pages/Inventory.jsx`
  - L25: `hasPermission('inventory:create') || hasPermission('inventory:update') || hasPermission('inventory:delete')` → `hasPermission('assets:create') || hasPermission('assets:update') || hasPermission('assets:delete')`
- `client/src/pages/AssetDetail.jsx`
  - L30: `hasPermission('inventory:update')` → `hasPermission('assets:update')`
- `client/src/context/AuthContext.jsx`
  - L10: `inventory:*` fallback keys → `assets:*` fallback keys

### Server Layer
- `server/middleware/validateSession.js`
  - L6: `inventory:*` fallback dictionary → `assets:*`
- `server/routes/assets.js`
  - L29: `requirePermission('inventory:read')` → `requirePermission('assets:read')`
  - L43: `requirePermission('inventory:export')` → `requirePermission('assets:export')`
  - L56: `requirePermission('inventory:import')` → `requirePermission('assets:import')`
  - L78: `requirePermission('inventory:read')` → `requirePermission('assets:read')`
  - L95: `requirePermission('inventory:read')` → `requirePermission('assets:read')`
  - L113: `requirePermission('inventory:create')` → `requirePermission('assets:create')`
  - L159: `requirePermission('inventory:update')` → `requirePermission('assets:update')`
  - L187: `requirePermission('inventory:delete')` → `requirePermission('assets:delete')`
  - L205: `requirePermission('inventory:assign')` → `requirePermission('assets:assign')`
  - L231: `requirePermission('inventory:assign')` → `requirePermission('assets:assign')`
  - L253: `requirePermission('inventory:delete')` → `requirePermission('assets:delete')`

---

## Catalog Key Mapping Target
- `inventory:read` → `assets:read`
- `inventory:create` → `assets:create`
- `inventory:update` → `assets:update`
- `inventory:delete` → `assets:delete`
- `inventory:export` → `assets:export`
- `inventory:import` → `assets:import`
- `inventory:assign` → `assets:assign`
- `employees:update` → `employees:manage`
- New added keys: `categories:read`, `categories:manage`, `locations:read`, `locations:manage`
