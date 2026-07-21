# AssetTrack — Engineering Rules & Standards

**Document Version:** 1.0  
**Date:** July 21, 2026  
**Status:** Active — All contributors must read before writing code  
**Owner:** Engineering Lead  

> These rules exist to keep the codebase consistent, secure, and maintainable as the team grows. If a rule feels wrong for a specific case, raise it in code review — don't silently break it.

---

## Table of Contents

1. [General Principles](#1-general-principles)
2. [Project Structure Rules](#2-project-structure-rules)
3. [Frontend Rules (React / Vite)](#3-frontend-rules-react--vite)
   - 3.1 Component Rules
   - 3.2 Naming Conventions
   - 3.3 State Management Rules
   - 3.4 API Communication Rules
   - 3.5 Styling Rules (Tailwind CSS)
   - 3.6 Routing Rules
4. [Backend Rules (Node.js / Express)](#4-backend-rules-nodejs--express)
   - 4.1 Route Handler Rules
   - 4.2 Service Layer Rules
   - 4.3 API Design Rules
   - 4.4 Error Handling Rules
   - 4.5 Input Validation Rules
5. [Database Rules (SQLite)](#5-database-rules-sqlite)
6. [Security Rules](#6-security-rules)
7. [Git & Version Control Rules](#7-git--version-control-rules)
8. [UI/UX Rules](#8-uiux-rules)
9. [Testing Rules](#9-testing-rules)
10. [Code Review Rules](#10-code-review-rules)
11. [Environment & Configuration Rules](#11-environment--configuration-rules)
12. [AI Boundaries & Usage Rules](#12-ai-boundaries--usage-rules)
    - 12.1 Permitted AI Use
    - 12.2 Prohibited AI Use
    - 12.3 Mandatory Human Review Gates
    - 12.4 Prompt Hygiene Rules
    - 12.5 AI-Assisted Code Review Rules
    - 12.6 AI Tool Inventory
13. [Quick Reference Card](#13-quick-reference-card)

---

## 1. General Principles

These four principles govern every decision in this codebase:

### 1.1 Clarity Over Cleverness
Write code for the next person reading it, not for the interpreter.

```javascript
// ❌ Clever — hard to scan
const s = a.filter(x => x.s === 'in-use').reduce((n, _) => n + 1, 0);

// ✅ Clear — intent is obvious
const inUseCount = assets.filter(asset => asset.status === 'in-use').length;
```

### 1.2 One Responsibility Per Unit
Every function, component, and module does exactly one thing well.

- A component either fetches data **or** renders UI — not both (use custom hooks for data).
- A route handler validates input and delegates to a service — it does not contain business logic.
- A service function performs one logical operation — it does not call other services in a chain.

### 1.3 Fail Loudly, Recover Gracefully
- In development: throw errors loudly so they are caught early.
- In production: catch all errors, log them server-side, and return a clean user-facing message.
- Never swallow errors silently with an empty `catch {}` block.

### 1.4 No Magic Numbers or Strings
All constants must be named and placed in `utils/constants.js` (frontend) or a dedicated `constants.js` (backend).

```javascript
// ❌ Magic string
if (asset.status === 'in-use') { ... }

// ✅ Named constant
import { ASSET_STATUS } from '../utils/constants';
if (asset.status === ASSET_STATUS.IN_USE) { ... }
```

```javascript
// utils/constants.js
export const ASSET_STATUS = {
  AVAILABLE: 'available',
  IN_USE: 'in-use',
  RETIRED: 'retired',
};

export const OFFICE_LOCATIONS = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];

export const HISTORY_EVENT_TYPES = {
  CREATED: 'created',
  ASSIGNED: 'assigned',
  RETURNED: 'returned',
  RETIRED: 'retired',
  DELETED: 'deleted',
  UPDATED: 'updated',
};
```

---

## 2. Project Structure Rules

### 2.1 File Placement
| Type | Location |
|---|---|
| Page-level view components | `client/src/pages/` |
| Reusable UI components | `client/src/components/<feature>/` |
| Primitive / atomic UI elements | `client/src/components/ui/` |
| Custom hooks | `client/src/hooks/` |
| Context providers | `client/src/context/` |
| API call functions | `client/src/api/` |
| Utility / helper functions | `client/src/utils/` |
| Express route definitions | `server/routes/` |
| Business logic functions | `server/services/` |
| Express middleware | `server/middleware/` |

### 2.2 One Component Per File
- Every React component lives in its own `.jsx` file.
- Filename must exactly match the component name.
- ❌ Never define two exported components in the same file.

### 2.3 No Business Logic in Route Files
Route files (`server/routes/*.js`) are thin controllers. They must:
1. Parse request parameters.
2. Call input validators.
3. Call a service function.
4. Return the result.

They must **not** contain SQL queries, business decisions, or data transformation logic.

---

## 3. Frontend Rules (React / Vite)

### 3.1 Component Rules

#### Functional Components Only
- Use arrow function components exclusively. No class components.

```javascript
// ✅ Correct
const AssetCard = ({ asset }) => {
  return <div>{asset.name}</div>;
};

export default AssetCard;
```

#### Props Destructuring
- Always destructure props in the function signature, not inside the body.

```javascript
// ❌ Don't
const AssetCard = (props) => {
  const name = props.asset.name;
};

// ✅ Do
const AssetCard = ({ asset }) => {
  const { name, status, serialNumber } = asset;
};
```

#### Export Default at Bottom
- Always export the component as `export default` at the end of the file.
- Never use inline `export default function`.

#### No Inline JSX Logic for Complex Conditions
```javascript
// ❌ Hard to read
return (
  <div>
    {asset.status === 'in-use' && employee && employee.isGoogleSynced
      ? <Badge>Verified</Badge>
      : null}
  </div>
);

// ✅ Extract to a variable
const showVerifiedBadge = asset.status === ASSET_STATUS.IN_USE
  && employee?.isGoogleSynced;

return (
  <div>
    {showVerifiedBadge && <Badge>Verified</Badge>}
  </div>
);
```

#### Keep JSX Returns Under 100 Lines
If a component's JSX return exceeds 100 lines, split it into sub-components.

### 3.2 Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Component files | PascalCase | `AssetDetailPage.jsx` |
| Hook files | camelCase, `use` prefix | `useAssets.js` |
| Context files | PascalCase | `AssetsContext.jsx` |
| API files | camelCase, `Api` suffix | `assetsApi.js` |
| Utility files | camelCase | `formatters.js` |
| CSS class names | Tailwind utilities | — |
| Component name | PascalCase | `AssetDetailPage` |
| Hook name | camelCase, `use` prefix | `useAssets` |
| Variable names | camelCase | `currentAsset` |
| Constants | SCREAMING_SNAKE_CASE | `ASSET_STATUS` |
| Event handlers | camelCase, `handle` prefix | `handleAssignClick` |
| Boolean variables | camelCase, `is/has/can` prefix | `isLoading`, `hasError` |

### 3.3 State Management Rules

#### Local vs. Global State
| State Type | Use |
|---|---|
| UI state (open/closed, hover, input value) | `useState` local to the component |
| Shared data used by multiple pages | Context |
| Derived/computed values | `useMemo` — never store in state |
| Side effects (fetch, subscriptions) | `useEffect` in a custom hook, not a component |

#### No Direct Context Mutation
Always use the dispatch functions / setters provided by the context. Never import `useContext` and mutate the value directly.

#### No `useEffect` Without a Cleanup
Every `useEffect` that subscribes to an event, sets a timer, or initiates a stream **must** return a cleanup function.

```javascript
// ✅ Correct — cleanup on unmount
useEffect(() => {
  const stream = startWebcam();
  return () => stopWebcam(stream);
}, []);
```

#### Derived State Prohibition
Never store computed values in state. Use `useMemo`.

```javascript
// ❌ Wrong — redundant state
const [filteredAssets, setFilteredAssets] = useState([]);
useEffect(() => {
  setFilteredAssets(assets.filter(a => a.status === filter));
}, [assets, filter]);

// ✅ Correct
const filteredAssets = useMemo(
  () => assets.filter(a => a.status === filter),
  [assets, filter]
);
```

### 3.4 API Communication Rules

- **All API calls** go through `src/api/axiosInstance.js`. Never use raw `fetch()`.
- **All API functions** must be async and return the response data (not the full Axios response object).
- **Loading and error states** must always be handled — no fire-and-forget API calls.
- **Never call API functions directly inside JSX** or event handlers — always go through a custom hook.

```javascript
// ❌ Wrong — calling API in component
const MyComponent = () => {
  const handleClick = async () => {
    const data = await axios.get('/api/assets'); // raw axios, no error handling
    setAssets(data);
  };
};

// ✅ Correct — using the hook
const MyComponent = () => {
  const { assets, isLoading, error } = useAssets();
  const { assignAsset } = useAssets();

  const handleClick = () => assignAsset(assetId, employeeId);
};
```

### 3.5 Styling Rules (Tailwind CSS)

#### No Inline `style` Props
Use Tailwind utility classes exclusively. Inline styles are only permitted for dynamic values that cannot be expressed as Tailwind classes (e.g., dynamic widths from data).

```jsx
// ❌ Avoid
<div style={{ backgroundColor: '#1e293b', padding: '16px' }}>

// ✅ Use Tailwind
<div className="bg-slate-800 p-4">
```

#### No Arbitrary Values Unless Necessary
Avoid Tailwind arbitrary values (e.g., `w-[342px]`) unless the value comes from data (e.g., a progress bar width percentage). Prefer design tokens.

#### Class Order Convention
Follow this order for Tailwind classes:
1. Layout (`flex`, `grid`, `block`)
2. Sizing (`w-*`, `h-*`, `max-w-*`)
3. Spacing (`p-*`, `m-*`, `gap-*`)
4. Typography (`text-*`, `font-*`, `leading-*`)
5. Colors (`bg-*`, `text-*`, `border-*`)
6. Effects (`shadow-*`, `opacity-*`, `blur-*`)
7. Interactivity (`cursor-*`, `hover:*`, `focus:*`)
8. Responsive (`sm:*`, `md:*`, `lg:*`)
9. Animation (`transition-*`, `animate-*`)

#### Status Color Mapping (Always Use These)
| Status | Background | Text | Usage |
|---|---|---|---|
| `in-use` | `bg-blue-500/20` | `text-blue-400` | Status pill |
| `available` | `bg-emerald-500/20` | `text-emerald-400` | Status pill |
| `retired` | `bg-slate-500/20` | `text-slate-400` | Status pill |
| Error | `bg-rose-500/20` | `text-rose-400` | Error states |
| Warning | `bg-amber-500/20` | `text-amber-400` | Warnings |

### 3.6 Routing Rules

- Every new page **must** be added to the routes array in `App.jsx`.
- All routes must be wrapped in `<ProtectedRoute>`.
- Use React Router's `useNavigate` hook for programmatic navigation — never `window.location.href`.
- URL parameters must use kebab-case (e.g., `/asset-detail/:id`, not `/assetDetail/:id`).
- Query strings are permitted only for filter state (e.g., `?status=in-use&category=laptop`).

---

## 4. Backend Rules (Node.js / Express)

### 4.1 Route Handler Rules

Route handlers must follow this exact structure:

```javascript
// routes/assets.js
router.post('/:id/assign', [
  param('id').isInt(),
  body('employeeId').isInt(),
  body('assignedDate').isISO8601(),
  validateRequest,          // middleware: check for validation errors
], async (req, res, next) => {
  try {
    const result = await assetService.assignAsset(
      req.params.id,
      req.body.employeeId,
      req.body.assignedDate,
      req.body.note,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);              // always delegate to global error handler
  }
});
```

**Rules:**
1. Validator middleware array comes first.
2. Handler is always `async`.
3. Handler body is always wrapped in `try/catch`.
4. Errors are always passed to `next(err)`.
5. Success responses always use an explicit HTTP status code.

### 4.2 Service Layer Rules

- Service functions must be **pure in intent** — same inputs produce the same database outcome.
- Service functions must not call `res` or `req` — they are HTTP-agnostic.
- Service functions must always log audit history when modifying an asset's state.
- If multiple database writes are needed in one operation (e.g., update asset + insert history), they **must** be wrapped in a SQLite transaction.

```javascript
// ✅ Correct — atomic transaction
const assignAsset = (assetId, employeeId, assignedDate, note) => {
  const assign = db.transaction(() => {
    db.prepare(`
      UPDATE assets SET status = 'in-use', assigned_to = ?, assigned_date = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(employeeId, assignedDate, assetId);

    db.prepare(`
      INSERT INTO asset_history (asset_id, event_type, employee_id, note, event_at)
      VALUES (?, 'assigned', ?, ?, datetime('now'))
    `).run(assetId, employeeId, note ?? null);
  });

  assign();
  return getAssetWithHistory(assetId);
};
```

### 4.3 API Design Rules

#### Response Shape
All API responses must follow a consistent shape:

```javascript
// Success (single resource)
{
  "data": { ...assetObject },
  "message": "Asset assigned successfully"
}

// Success (collection)
{
  "data": [ ...assets ],
  "total": 42,
  "message": "OK"
}

// Error
{
  "error": true,
  "message": "Asset not found",
  "code": 404
}
```

#### HTTP Status Codes
| Scenario | Status Code |
|---|---|
| Successful read | `200 OK` |
| Successful create | `201 Created` |
| Successful update/action | `200 OK` |
| Successful delete | `200 OK` (with `{ message: "Deleted" }`) |
| Validation error | `400 Bad Request` |
| Unauthorized | `401 Unauthorized` |
| Forbidden (wrong domain) | `403 Forbidden` |
| Resource not found | `404 Not Found` |
| Conflict (duplicate serial) | `409 Conflict` |
| Server error | `500 Internal Server Error` |

#### Endpoint Naming
- Use **plural nouns** for resource collections: `/api/assets`, `/api/employees`.
- Use **kebab-case** for multi-word resources: `/api/asset-history`.
- Use **action verbs as sub-resources** for lifecycle operations: `POST /api/assets/:id/assign`.
- Never use verbs in the base resource path: ❌ `/api/getAssets`, ✅ `GET /api/assets`.

### 4.4 Error Handling Rules

- All thrown errors must be `Error` objects with a `message` and optionally a `statusCode` property.
- The global error handler in `middleware/errorHandler.js` is the single place that formats error responses.
- Never return a stack trace to the client in production.

```javascript
// ✅ Throwing a handled error
const getAsset = (id) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  if (!asset) {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }
  return asset;
};
```

### 4.5 Input Validation Rules

- Every route that accepts user input **must** have `express-validator` rules.
- Never trust client-supplied data. Validate type, format, and allowed values.
- The `validateRequest` middleware must always be the last item in the validator array.
- Validate serial numbers match the expected pattern: `/^[A-Z0-9\-]{4,30}$/`.
- Validate status values against the enum: `isIn(['available', 'in-use', 'retired'])`.

---

## 5. Database Rules (SQLite)

### 5.1 Parameterized Queries — Non-Negotiable

**NEVER** build SQL strings with user input. **ALWAYS** use `better-sqlite3` placeholders.

```javascript
// 🚨 FORBIDDEN — SQL injection vulnerability
db.exec(`SELECT * FROM assets WHERE name = '${req.body.name}'`);

// ✅ REQUIRED — parameterized
db.prepare('SELECT * FROM assets WHERE name = ?').get(req.body.name);
```

### 5.2 Transaction Rule
Any operation that requires more than one write (INSERT + UPDATE, etc.) **must** use `db.transaction()`. This ensures atomicity — either all writes succeed or none do.

### 5.3 Schema Modification Rules
- Never modify the schema directly on the production database file.
- All schema changes must be written as numbered migration scripts in `server/migrations/`.
- Migration files must be named: `001_initial_schema.sql`, `002_add_index_assets_status.sql`, etc.
- The server startup script in `db.js` must apply all pending migrations in order.

### 5.4 Query Performance Rules
- Every foreign key column **must** have an index.
- Any column used in a `WHERE` clause more than once across the codebase **must** have an index.
- Avoid `SELECT *` in service functions — select only the columns the caller needs.
- Use `LIMIT` on all list queries. Default limit: `100`. Maximum limit: `500`.

### 5.5 Soft vs. Hard Delete
- **Assets**: Hard delete is permitted (and logs a `deleted` history event beforehand).
- **Employees**: Soft delete only — add a `deleted_at` column; never `DELETE FROM employees` (preserves historical assignment records).
- **Categories**: Hard delete only if no assets reference it. If assets reference it, return `409 Conflict`.
- **History records**: Never delete. The audit log is immutable.

---

## 6. Security Rules

### 6.1 Secrets — Absolute Rules
1. **Never commit secrets to Git.** Client IDs, secrets, session keys — all in `.env` files.
2. **`.env` files are in `.gitignore`.** Always. Verify before every commit.
3. **Never log secrets.** No `console.log(process.env.GOOGLE_CLIENT_SECRET)`.
4. **Never expose `GOOGLE_CLIENT_SECRET` to the frontend.** It lives only in `server/.env`.
5. **Never hardcode fallback secret values** in source code (e.g., `process.env.SECRET || 'mysecret'`).

### 6.2 Authentication Rules
- Every `/api/*` route (except public health check) must validate the session token.
- Session tokens expire after 8 hours of inactivity.
- Only users whose email `@domain` matches the configured Google Workspace domain are admitted.
- If the session is invalid or expired, return `401 Unauthorized` — never silently proceed.

### 6.3 Data Exposure Rules
- Never return password hashes, raw tokens, or Google refresh tokens in API responses.
- Employee `google_id` should not be exposed in public-facing list endpoints.
- Cost data (cost_cents) should only be returned to authenticated admin sessions.

### 6.4 HTTPS Rules
- All production traffic **must** use HTTPS.
- `getUserMedia()` (webcam) will fail on HTTP — do not attempt HTTP deployment.
- Set the following response headers on all production requests:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  ```

### 6.5 Confirmation for Destructive Actions
- Any API endpoint that retires, deletes, or bulk-modifies data must accept an explicit `confirm: true` field in the request body.
- The corresponding UI must show a confirmation dialog before calling these endpoints.

---

## 7. Git & Version Control Rules

### 7.1 Branch Naming

| Branch Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/barcode-scanner` |
| Bug fix | `fix/<short-description>` | `fix/serial-duplicate-check` |
| Refactor | `refactor/<short-description>` | `refactor/asset-service-layer` |
| Documentation | `docs/<short-description>` | `docs/update-architecture` |
| Hotfix | `hotfix/<short-description>` | `hotfix/google-auth-loop` |

### 7.2 Commit Message Convention

Follow the **Conventional Commits** specification:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:**

| Type | When to Use |
|---|---|
| `feat` | New feature or user-visible behaviour |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change |
| `style` | Formatting, whitespace only |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Build scripts, dependencies, configs |
| `perf` | Performance improvement |

**Examples:**
```
feat(scanner): add live webcam ZXing barcode decoder
fix(assets): prevent duplicate serial number on registration
refactor(services): extract assignAsset into assetService
docs(arch): update deployment section with Docker Compose
chore(deps): bump better-sqlite3 to 9.4.3
```

**Rules:**
- Subject line max: **72 characters**.
- Subject line: imperative mood, no period at end. ("add X", not "added X" or "adds X").
- Body: explain **why**, not **what** (the diff already shows what).
- Never commit directly to `main`. Always use a pull request.

### 7.3 Pull Request Rules
- PRs must reference the related issue number: `Closes #42`.
- PRs must have at least **1 reviewer approval** before merging.
- PRs must pass all automated checks before merging.
- Squash-merge is preferred to keep `main` history clean.
- Delete the feature branch after merging.

### 7.4 What Never Goes in Git
```
.env
.env.local
.env.*.local
node_modules/
data/assets.db
backups/
client/dist/
*.log
.DS_Store
```

---

## 8. UI/UX Rules

### 8.1 Loading States
- Every async operation visible to the user **must** have a loading state.
- Use the `<Spinner />` component — never a raw "Loading..." text string.
- Skeleton loaders are preferred over spinners for full-page data fetches.

### 8.2 Empty States
- Every list, table, or grid that can be empty **must** have an empty state.
- Empty states must include: an illustration/icon, a short message, and (where applicable) a call-to-action button.
- Never render an empty `<div>` or `<ul>` silently.

### 8.3 Error States
- Every component that fetches data must handle API errors.
- Error states must show: a descriptive message and a "Retry" button.
- Network errors must trigger the global offline banner (not a per-component error).

### 8.4 Toast Notification Rules
- Success actions → green toast (auto-dismiss after 3 seconds).
- Failed actions → red toast (auto-dismiss after 5 seconds).
- Informational events → blue toast (auto-dismiss after 3 seconds).
- Never show more than 3 toasts simultaneously.
- Use `react-hot-toast` — no custom toast implementations.

### 8.5 Modal Rules
- Modals must close on: Escape key press, clicking the backdrop overlay, or clicking the Close button.
- Modals must trap focus (Tab/Shift-Tab cycles only within the modal).
- Destructive action modals (Delete, Retire) must use a red confirm button, not the primary action color.
- Never nest modals. If a secondary modal is needed, close the first one first.

### 8.6 Form Rules
- All required fields must be marked with a red `*` asterisk.
- Validation errors must appear inline beneath the relevant field — not only as a toast.
- Submit buttons must be disabled while a form submission is in progress.
- Forms must not reset on a validation error — preserve user-entered values.
- Date pickers must show the format placeholder (`YYYY-MM-DD`).

### 8.7 Accessibility Rules
- All interactive elements must have accessible labels (`aria-label` or visible text).
- Images must have `alt` attributes (or `alt=""` for decorative images).
- Color must not be the only visual differentiator — always pair with an icon or text label.
- Minimum tap target size on mobile: **44×44px**.
- All form inputs must have associated `<label>` elements.

---

## 9. Testing Rules

### 9.1 What Must Be Tested (v1 scope)

| Layer | Test Type | Tool |
|---|---|---|
| API route handlers | Integration tests (HTTP) | `supertest` + `vitest` |
| Service functions | Unit tests | `vitest` |
| Serial generator | Unit tests | `vitest` |
| Utility / formatter functions | Unit tests | `vitest` |
| Critical UI flows (assign, retire) | E2E (future v1.1) | Playwright |

### 9.2 Test File Location & Naming
- Test files live alongside the code they test.
- Test files are named `<filename>.test.js` or `<filename>.test.jsx`.
- e.g., `assetService.test.js` lives in `server/services/`.

### 9.3 Test Rules
- Each test must be independent — no test should rely on the state left by a previous test.
- Use a separate in-memory SQLite database for backend tests — never run tests against `assets.db`.
- Test names must be descriptive: `"should return 404 when asset ID does not exist"` not `"test 1"`.
- Cover both the happy path and at least one error/edge case per function.
- Never mock the database in service tests — use a real in-memory DB.

### 9.4 Test Coverage Targets (v1)
| Module | Target Coverage |
|---|---|
| `assetService.js` | ≥ 80% |
| `employeeService.js` | ≥ 70% |
| `googleService.js` | ≥ 60% |
| `serialGenerator.js` | 100% |
| `formatters.js` | 100% |
| API routes | ≥ 70% |

---

## 10. Code Review Rules

### 10.1 Reviewer Responsibilities
- Read the **entire diff**, not just the changed lines.
- Check that the PR description explains **why** the change was made.
- Verify the PR does not break the rules in this document.
- Do not approve a PR that has unresolved comments from another reviewer.

### 10.2 Author Responsibilities
- Self-review your own diff before requesting a review.
- Keep PRs small (< 400 changed lines where possible). Large PRs are harder to review and more likely to introduce bugs.
- Respond to all review comments — either address them or explain why you disagree.
- Do not merge without approval.

### 10.3 Code Review Checklist

Before approving any PR, verify:

**General**
- [ ] Code follows naming conventions in this document
- [ ] No magic strings or numbers (constants used)
- [ ] No commented-out code committed
- [ ] No `console.log` left in production code (use proper logging)
- [ ] No `TODO` comments without a linked issue number

**Frontend**
- [ ] No raw `fetch()` or `axios` calls outside `src/api/`
- [ ] Loading, empty, and error states handled
- [ ] No business logic inside JSX return
- [ ] Tailwind classes used (no inline `style` props)
- [ ] Accessible (aria labels, label elements)

**Backend**
- [ ] All DB queries are parameterized (no string interpolation in SQL)
- [ ] Multi-write operations use transactions
- [ ] Route handlers delegate to services (no business logic in routes)
- [ ] All error paths call `next(err)`
- [ ] Input validated with `express-validator`

**Security**
- [ ] No secrets hardcoded or logged
- [ ] `.env` not committed
- [ ] Destructive actions require `confirm: true`

**Database**
- [ ] Schema changes are in a numbered migration file
- [ ] No `SELECT *` in service functions
- [ ] New FK columns have an index

---

## 11. Environment & Configuration Rules

### 11.1 Environment File Rules
- `.env` files must never be committed. Always verify `.gitignore`.
- A `.env.example` file with placeholder values **must** be committed and kept up to date.
- Every developer must copy `.env.example` to `.env` and fill in values locally.

### 11.2 Port Rules
| Service | Default Port | Environment Variable |
|---|---|---|
| Express backend | `3001` | `PORT` |
| Vite frontend | `5173` | (Vite default) |

### 11.3 Configuration Hierarchy
1. Environment variables (`.env`) — highest priority.
2. Hardcoded defaults in code — lowest priority, only for non-sensitive defaults (e.g., port number).

```javascript
// ✅ Correct pattern
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DATABASE_PATH || './data/assets.db';

// ❌ Never for secrets
const SECRET = process.env.SESSION_SECRET || 'fallback-secret'; // forbidden
```

### 11.4 Logging Rules
- Use `morgan` for HTTP request logging in Express.
- Use `console.error` for unexpected errors (structured logging tool to be added in v1.1).
- Log the following at startup: port, database path, Node.js version, and environment (`development`/`production`).
- Never log: passwords, tokens, secrets, or personally identifiable information (PII).

---

## 12. AI Boundaries & Usage Rules

> AI coding assistants (GitHub Copilot, Claude, ChatGPT, Gemini, Cursor, etc.) are permitted tools on this project — but they operate within firm boundaries. AI output is **untrusted input** until reviewed, tested, and approved by a human engineer. These rules define exactly where AI helps and where it must not act autonomously.

### 12.1 Permitted AI Use

The following uses of AI assistance are **explicitly allowed**:

| Use Case | Examples | Notes |
|---|---|---|
| Boilerplate generation | Scaffold a new React component, generate a route handler shell | Must be reviewed before committing |
| Autocomplete & inline suggestions | Completing a function body, filling repetitive patterns | Accept only what you understand |
| Writing unit tests | Generate test cases for a service function | Verify all assertions make sense |
| Writing documentation | JSDoc comments, README sections, inline comments | Must be accurate to actual behaviour |
| Debugging assistance | Explaining an error, suggesting a fix | Fix must be understood before applying |
| Refactoring suggestions | Simplifying a long function, extracting a hook | Apply only after manual verification |
| SQL query drafting | Drafting a SELECT with JOINs | **Must** be converted to parameterized form before use |
| Regex / pattern construction | Serial number validation regex | Verify the pattern against real data |
| Commit message drafting | Generating a Conventional Commits message | Review for accuracy |

---

### 12.2 Prohibited AI Use

The following uses are **explicitly forbidden** — no exceptions:

#### 12.2.1 Security-Critical Code — No Autonomous AI Generation
- ❌ **OAuth token exchange logic** — AI must not write the Google token validation or session creation code autonomously. A human must write and own this end-to-end.
- ❌ **Session middleware** — The auth guard middleware (`validateSession`) must be human-authored.
- ❌ **Secret / credential handling** — Any code that reads, stores, or transmits `GOOGLE_CLIENT_SECRET`, session tokens, or access tokens must be human-written.
- ❌ **CORS configuration** — The `cors()` policy must be manually reviewed and set. AI-suggested wildcard origins (`origin: '*'`) are forbidden.
- ❌ **Input sanitization rules** — `express-validator` rule sets must be written and reviewed by a human, not auto-generated and copy-pasted.

#### 12.2.2 Database Schema — No Autonomous Changes
- ❌ AI must not generate or modify migration files without explicit human instruction and review.
- ❌ AI must never suggest `DROP TABLE`, `DELETE FROM`, or `TRUNCATE` queries in any context, even for seeding/testing.
- ❌ AI-generated queries that use string interpolation instead of parameterized placeholders must be **rejected immediately** — do not fix them, start over.

#### 12.2.3 Autonomous Commits & PRs
- ❌ AI tools must never be granted permission to directly commit to any branch.
- ❌ AI tools must never be granted permission to open, approve, or merge pull requests.
- ❌ No CI/CD pipeline step may run AI-generated code without a prior human code review.

#### 12.2.4 Employee / PII Data Handling
- ❌ AI must not be used to process, analyse, or transform real employee data (names, emails, Google IDs).
- ❌ Do not paste real employee records, real serial numbers, or real Google Client IDs into any AI chat interface.
- ❌ Do not use AI to write data export/import scripts that touch the production `assets.db`.

#### 12.2.5 Architecture & System Design Decisions
- ❌ AI must not make final decisions on architecture (database engine choice, auth strategy, deployment model). AI may be consulted for options, but a human engineer makes the final call and documents the rationale.
- ❌ AI-generated architectural diagrams or ERDs must not be treated as authoritative — verify against the actual codebase.

---

### 12.3 Mandatory Human Review Gates

Before any AI-generated code is merged, it must pass these checkpoints — each signed off by a human:

```
AI generates code suggestion
         │
         ▼
┌─────────────────────────────────────┐
│ Gate 1 — Author Self-Review         │
│ • Do I fully understand every line? │
│ • Would I write it this way myself? │
│ • Does it follow our rules.md?      │
└────────────────┬────────────────────┘
                 │  Pass
                 ▼
┌─────────────────────────────────────┐
│ Gate 2 — Security Scan              │
│ • No hardcoded secrets              │
│ • No SQL string interpolation       │
│ • No wildcard CORS or open auth     │
│ • No PII in logs or responses       │
└────────────────┬────────────────────┘
                 │  Pass
                 ▼
┌─────────────────────────────────────┐
│ Gate 3 — Test Coverage              │
│ • At least one unit test added      │
│ • Tests pass locally                │
│ • Edge cases are covered            │
└────────────────┬────────────────────┘
                 │  Pass
                 ▼
┌─────────────────────────────────────┐
│ Gate 4 — Peer Code Review           │
│ • Second human has reviewed the PR  │
│ • Reviewer did not just skim it     │
│ • All checklist items in §10.3 done │
└────────────────┬────────────────────┘
                 │  Pass
                 ▼
          Approved to Merge
```

**If any gate fails, the code goes back — not forward.**

---

### 12.4 Prompt Hygiene Rules

When using AI tools for this project, follow these prompt rules to avoid leaking sensitive data and to get better output:

#### What NEVER to include in a prompt:
- ❌ Real employee names, emails, or Google Workspace IDs.
- ❌ Real Google Client IDs or Client Secrets.
- ❌ Contents of the production `.env` file.
- ❌ Actual database rows from `assets.db`.
- ❌ Internal office details (specific headcounts, salary data, etc.).

#### What to include for effective prompts:
- ✅ Anonymised, fictional example data (e.g., `employee@example.com`, `SN-ABC123`).
- ✅ The specific file name and function signature you are working in.
- ✅ The relevant rules from this document (paste the specific rule, e.g., §5.1 parameterized queries).
- ✅ The expected input/output behaviour.
- ✅ Any known constraints (e.g., "must use better-sqlite3 synchronous API").

#### Prompt Template (recommended for code generation tasks):
```
Context: I am building AssetTrack, a Node.js/Express + SQLite asset management system.
File: server/services/assetService.js
Task: Write a function called [functionName] that [does X].
Constraints:
  - Use better-sqlite3 parameterized queries only (no string interpolation).
  - Wrap multi-write operations in db.transaction().
  - Throw an Error with statusCode property on failure.
  - Do not use any external libraries.
Example input: { assetId: 1, employeeId: 5, note: 'Issued on joining' }
Expected output: The updated asset object with its history array.
```

---

### 12.5 AI-Assisted Code Review Rules

AI tools **may** be used to assist in code review under these conditions:

| Allowed | Not Allowed |
|---|---|
| Use AI to spot potential bugs or edge cases in a diff | Use AI as a substitute for human review |
| Use AI to check if a SQL query looks safe | Auto-approve a PR because "AI said it looks fine" |
| Use AI to suggest better variable names | Let AI approve or merge PRs |
| Use AI to verify regex patterns | Trust AI's security assessment without manual verification |

**The golden rule:** AI is a second pair of eyes, not the first and only reviewer. A human must always read and approve the final code.

#### AI Review Checklist Addition
When AI tools are used during code review, add this note to the PR:
```
## AI Assistance Disclosure
- [ ] AI tool used for: [boilerplate / tests / debugging / review assistance / other]
- [ ] All AI-generated code has been manually read and understood by the author
- [ ] No real credentials, PII, or production data was submitted to the AI tool
- [ ] Security gates in §12.3 have been passed
```

---

### 12.6 AI Tool Inventory

Only these AI tools are approved for use on this project. Any new tool must be reviewed and added to this list by the Engineering Lead before use.

| Tool | Approved Use | Prohibited Use |
|---|---|---|
| **GitHub Copilot** | Inline autocomplete, test generation | Auto-commit, PR creation |
| **Claude (Anthropic)** | Code generation, documentation, debugging | Submitting real credentials or PII |
| **ChatGPT (OpenAI)** | Debugging, architecture discussion | Submitting real credentials or PII |
| **Gemini (Google)** | Code assistance, documentation | Submitting real credentials or PII |
| **Cursor AI** | Inline edits, refactoring | Auto-applying multi-file changes without review |

> **Adding a new AI tool?** Open a `docs/` PR adding it to this table with approved/prohibited use cases. Get Engineering Lead approval before using it on the codebase.

---

## 13. Quick Reference Card

```
┌────────────────────────────────────────────────────────────────┐
│                  ASSETTRACK RULES — QUICK REF                  │
├────────────────────────────────────────────────────────────────┤
│ NAMING                                                         │
│  Components      → PascalCase       AssetCard.jsx             │
│  Hooks           → useCamelCase     useAssets.js              │
│  Constants       → SCREAMING_SNAKE  ASSET_STATUS.IN_USE       │
│  Event handlers  → handleXxx        handleAssignClick         │
│  Booleans        → isXxx / hasXxx   isLoading, hasError       │
│  API files       → xxxApi.js        assetsApi.js              │
├────────────────────────────────────────────────────────────────┤
│ COMMITS                                                        │
│  feat(scope): add barcode scanner                             │
│  fix(scope): prevent duplicate serial                          │
│  refactor(scope): extract service layer                        │
├────────────────────────────────────────────────────────────────┤
│ BRANCHES                                                       │
│  feat/barcode-scanner                                          │
│  fix/serial-duplicate-check                                    │
│  docs/update-prd                                               │
├────────────────────────────────────────────────────────────────┤
│ HTTP STATUS CODES                                              │
│  200 → OK (read/update/action)                                 │
│  201 → Created                                                 │
│  400 → Bad Request / Validation error                          │
│  401 → Unauthorized                                            │
│  403 → Forbidden (wrong domain)                                │
│  404 → Not Found                                               │
│  409 → Conflict (duplicate serial)                             │
│  500 → Internal Server Error                                   │
├────────────────────────────────────────────────────────────────┤
│ NEVER DO                                                       │
│  ❌ Raw SQL string interpolation                               │
│  ❌ Secrets in source code or Git                              │
│  ❌ Business logic in route handlers                           │
│  ❌ fetch() outside src/api/                                   │
│  ❌ Class components                                           │
│  ❌ Direct Context mutation                                    │
│  ❌ console.log in production code                             │
│  ❌ SELECT * in service queries                                 │
│  ❌ Merge to main without PR + review                          │
├────────────────────────────────────────────────────────────────┤
│ ALWAYS DO                                                      │
│  ✅ Parameterized DB queries                                   │
│  ✅ Transactions for multi-write operations                    │
│  ✅ Loading + empty + error states in UI                       │
│  ✅ Input validation on every POST/PUT                         │
│  ✅ Audit log entry on every asset state change                │
│  ✅ Confirmation dialog before destructive actions             │
│  ✅ HTTPS in production                                        │
├────────────────────────────────────────────────────────────────┤
│ AI BOUNDARIES                                                  │
│  ✅ Use AI for: boilerplate, tests, docs, debugging            │
│  ✅ Use AI for: autocomplete, refactoring suggestions          │
│  ❌ No AI for: OAuth/session/security-critical code            │
│  ❌ No AI for: schema migrations or DROP/DELETE queries        │
│  ❌ No AI for: autonomous commits, PR approvals, or merges     │
│  ❌ Never paste: real .env, credentials, or employee PII       │
│  ⚠ Every AI output needs: self-review → security → test → PR  │
└────────────────────────────────────────────────────────────────┘
```

---

*End of Document*

**Last updated by:** Engineering Lead  
**Questions?** Raise in the engineering Slack channel or open a documentation PR.
