# AssetTrack — Design Document (UI/UX)

**Document Version:** 1.0
**Date:** July 21, 2026
**Status:** Draft — for Engineering & Product Review
**Source Documents:** PRD v1.0, Architecture v1.0, Rules v1.0, Phases v1.0
**Owner:** Design / Frontend Lead

> This document translates the requirements in the PRD (§9 UI/UX Requirements), the component tree in the Architecture doc (§3), and the UI/UX Rules (Rules §8) into a concrete design system and screen-by-screen spec. Every visual decision below is traceable to a source requirement — nothing here contradicts the three source documents.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Design System (Tokens)](#2-design-system-tokens)
3. [Layout & Navigation](#3-layout--navigation)
4. [Component Library](#4-component-library)
5. [Screen-by-Screen Specs](#5-screen-by-screen-specs)
6. [Interaction & Motion](#6-interaction--motion)
7. [Responsive Behavior](#7-responsive-behavior)
8. [State Patterns (Loading / Empty / Error)](#8-state-patterns-loading--empty--error)
9. [Accessibility](#9-accessibility)
10. [Example View](#10-example-view)

---

## 1. Design Principles

AssetTrack is an **internal operations tool**, not a consumer product — it is used daily by IT admins scanning stickers on the back of laptops, comparing spreadsheets across four cities, and running quarterly audits. The design follows from that job:

1. **Legibility over decoration.** Serial numbers, statuses, and timestamps are the content. Monospace where precision matters (serials), tabular alignment where scanning matters (tables), and status color-coding that never relies on color alone (Rules §8.7).
2. **Dark by default, calm under long sessions.** Admins may have this open all day next to a terminal — a dark slate surface (per PRD §9.1) with a single indigo accent keeps eye strain low and avoids visual noise competing with data.
3. **One accent, used with intent.** Indigo (`#6366F1`) is reserved for primary actions and active/selected states. Every other color (emerald, amber, rose, blue, purple) is a **semantic** signal — status, category, or activity type — never decorative.
4. **Every state is designed, not default.** Per Rules §8.1–§8.3, loading, empty, and error states are first-class screens, not afterthoughts. A blank table or a silent spinner is treated as a bug.
5. **The scanner is the signature moment.** It's called out in the PRD as the "core differentiator" (§6.4). It gets the one piece of expressive motion in the app — the animated laser scanline — while everything else stays quiet and functional.

---

## 2. Design System (Tokens)

These tokens are fixed by PRD §9.1 and are treated as source of truth; the table below expands them into a usable token system for implementation.

### 2.1 Color

| Token | Dark (Default) | Light (New) | Usage |
|---|---|---|---|
| `bg-base` | `#0F172A` (slate-900) | `#F1F5F9` (slate-100) | App background |
| `bg-surface` | `#1E293B` (slate-800) | `#FFFFFF` | Cards, sidebar, table rows |
| `bg-surface-raised` | `#27354A` | `#FFFFFF` | Modals, dropdowns, hover surfaces |
| `border-default` | `#334155` (slate-700) | `#E2E8F0` (slate-200) | Card borders, dividers, input borders |
| `text-primary` | `#F1F5F9` (slate-100) | `#0F172A` (slate-900) | Headings, primary content |
| `text-secondary` | `#94A3B8` (slate-400) | `#64748B` (slate-500) | Labels, meta text, placeholders |
| `accent-primary` | `#6366F1` (indigo-500) | `#6366F1` (indigo-500) | Primary buttons, active nav, links, focus ring |
| `accent-primary-hover` | `#818CF8` (indigo-400) | `#4F46E5` (indigo-600) | Hover state on primary elements |
| `success` | `#10B981` (emerald-500) | `#059669` (emerald-600) | Available status, success toasts, positive deltas |
| `warning` | `#F59E0B` (amber-500) | `#D97706` (amber-600) | Status-change activity tag, pending states |
| `danger` | `#F43F5E` (rose-500) | `#E11D48` (rose-600) | Retire/delete actions, error toasts, retired status text |
| `info-blue` | `#3B82F6` | `#2563EB` (blue-600) | In-Use status, assignment activity tag |
| `info-purple` | `#8B5CF6` | `#7C3AED` (purple-600) | Category activity tag |

Category accent palette (8 curated options, PRD §6.6.2): Blue `#3B82F6` · Indigo `#6366F1` · Purple `#8B5CF6` · Teal `#14B8A6` · Cyan `#06B6D4` · Emerald `#10B981` · Amber `#F59E0B` · Rose `#F43F5E`.

### 2.2 Theme State & Toggle

- **Persistence**: Managed via a React `ThemeContext` and persisted in `localStorage` under `assettrack-theme`.
- **Default Behavior**: Defaults to `dark` for new visitors (matching the "dark by default" product decision).
- **Toggle**: Available in the `TopBar` as a `Sun`/`Moon` icon next to the notifications bell.

### 2.3 Typography

| Role | Font | Notes |
|---|---|---|
| UI / body | **Inter** (Google Fonts) | Per PRD §9.1. Weights 400/500/600/700. |
| Data / monospace | **JetBrains Mono** or system mono | Serial numbers, IDs, timestamps — anywhere precision matters. |

**Type scale:**

| Level | Size / Weight | Usage |
|---|---|---|
| Display | 28px / 700 | Page titles ("Dashboard", "Inventory") |
| H2 | 20px / 600 | Section headers, card titles |
| H3 | 16px / 600 | Sub-section labels, modal titles |
| Body | 14px / 400 | Table cells, form labels, descriptions |
| Small | 12px / 500 | Meta text, timestamps, badge labels |
| Mono | 13px / 500, monospace | Serial numbers, client IDs |

### 2.4 Spacing & Shape

| Token | Value |
|---|---|
| Card radius | `0.75rem` (12px) — per PRD §9.1 |
| Input radius | `0.5rem` (8px) |
| Pill radius | `9999px` (status pills, filter chips, badges) |
| Base spacing unit | `4px` grid (4/8/12/16/24/32/48px steps) |
| Card padding | `20px` (mobile: `16px`) |
| Page gutter | `32px` desktop / `16px` mobile |

### 2.5 Elevation

Flat by default (dark UIs rely on borders, not shadows, for separation). Two exceptions:
- **Card hover:** `translateY(-2px)` + soft shadow (`0 8px 24px rgba(0,0,0,0.35)`).
- **Modals / dropdowns:** `0 16px 40px rgba(0,0,0,0.5)` to lift above the backdrop.

---

## 3. Layout & Navigation

Structure follows Architecture §3.4 (Component Tree) and PRD §9.2.

```
┌───────────────┬──────────────────────────────────────────────┐
│               │  TopBar: [≡] [Search......] [🔔] [Admin▾]    │
│   Sidebar     ├──────────────────────────────────────────────┤
│               │                                                │
│  ◆ Dashboard  │              <Outlet /> page content          │
│    Inventory  │                                                │
│    Scanner    │                                                │
│    Employees  │                                                │
│    Categories │                                                │
│  + Add Asset  │                                                │
│    Settings   │                                                │
│               │                                                │
│  [Rajan S.]   │                                                │
│  IT Admin     │                                                │
└───────────────┴──────────────────────────────────────────────┘
```

- **Sidebar:** fixed 240px on desktop, collapses to a 64px icon rail on tablet, becomes a bottom tab bar of 5 primary items on mobile (PRD §9.3). Active route gets a filled indigo pill behind the icon + label and a 3px indigo left-border accent. Role-based visibility applies:
  - **Admin**: Dashboard, Inventory, Tickets, Onboarding, Scanner, Employees, Categories, Settings
  - **Employee**: Dashboard, Tickets
  - **HR**: Dashboard, Onboarding, Employees, Tickets
- **TopBar:** persistent universal search (Inventory §6.2.1 lives here globally, not just on the Inventory page, so admins can search from anywhere), offline-status indicator (Rules §10.3), and the **User Menu** dropdown (avatar, email, role, Change Password, and Log Out). Redundant page-title text is excluded here in favor of in-page headings. A hamburger menu allows toggling the sidebar on/off on narrower viewports.
- **"Add Asset"** is visually separated from the other nav items (its own accent-filled button treatment) since it's the single most frequent write action for the primary persona.

---

## 4. Component Library

Maps 1:1 to `client/src/components/ui/` in Architecture §3.2, so component names below match filenames for direct implementation.

| Component | Spec |
|---|---|
| `Button.jsx` | Variants: `primary` (indigo fill), `secondary` (slate outline), `danger` (rose fill, for Retire/Delete confirms per Rules §8.5), `ghost` (text-only, for table row actions). 40px height, 8px radius, disabled state at 40% opacity + `not-allowed` cursor while a submission is in progress (Rules §8.6). |
| `Badge.jsx` | 1-character category badge: 28×28px circle, category accent color as background, white bold character. Used in table rows, category cards, asset detail. |
| `StatusPill.jsx` | Pill (9999px radius), 12px text, icon + label (never color alone, Rules §8.7): 🟢 Available (emerald), 🔵 In Use (blue, subtle pulse animation per PRD §9.5), ⚪ Retired (slate/grey, no pulse). |
| `Modal.jsx` | Centered, max-width 480–640px depending on content, backdrop blur `rgba(15,23,42,0.7)`. Fade + scale-in 200ms (PRD §9.5). Closes on Escape/backdrop/✕ (Rules §8.5). Focus-trapped. Never nested — a second modal always closes the first first. |
| `Toast.jsx` | Bottom-right stack, max 3 visible (Rules §8.4). Success = emerald left-border, 3s auto-dismiss. Error = rose left-border, 5s auto-dismiss. Info = indigo left-border, 3s auto-dismiss. |
| `Spinner.jsx` | Indigo ring spinner for inline/button loading. Full-page fetches use a **skeleton loader** (shimmering slate-700 blocks matching the target layout), preferred over spinners per Rules §8.1. |
| `EmptyState.jsx` | Centered icon (outline style, slate-500), 16px headline, 14px supporting text, optional CTA button. Used on every empty list/table/grid (Rules §8.2). |
| Filter Chip | Pill, outline by default; fills with indigo + white text when active (150ms transition, PRD §9.5). |
| Data Table | Slate-800 surface, slate-700 row dividers, row hover = slate-700 background, sortable column headers with a chevron indicator, horizontally scrollable on narrow viewports. |

---

## 5. Screen-by-Screen Specs

### 5.1 Admin Dashboard (`/`)

Per PRD §6.1. Top to bottom:

1. **Metric grid** — 4 cards (Total Assets, In Use, Available, Retired), responsive `grid-cols-4 → 2 → 1`. Each card: big number (count-up animation on load), label, small week-over-week delta chip (▲ emerald / ▼ rose).
2. **Two-column split** (stacks on mobile):
   - **Left — Inventory Breakdown:** horizontal bar per category — badge, label, count, and a filled-track bar sized to % of total. Updates live as categories are added.
   - **Right — Google Workspace Banner:** card with Google "G" mark, connection status pill (Connected/Not Configured), domain, synced-employee count, and a "Configure →" link into Settings.
3. **Activity Feed** — reverse-chronological list, 20 items, each row: colored action-type tag (assignment=blue, google=green, status=amber, category=purple, retire=rose per PRD §6.1.4), description sentence, relative timestamp right-aligned. New items slide in from the bottom. "Load more" at the foot.

### 5.2 Employee Dashboard (`/`)

The landing page exclusively for Employee roles. Genuinely separate component from Admin Dashboard.

- **My Assets**: Read-only list of assets currently assigned to this employee. Displays category badge, asset name, serial number, and assignment date. Reuses existing card styling. No edit/assign/retire actions.
- **My Tickets**: List of this employee's raised tickets with live status badges. Includes a button to open the "Raise Ticket" modal flow. Reuses existing ticket list formatting.
- Excludes all admin stat cards, inventory breakdown, and global activity feeds.

### 5.3 HR Dashboard (`/`)

The landing page exclusively for HR Partner roles. Genuinely separate component from Admin Dashboard.

- **My Onboarding Requests**: List of this HR user's submitted onboarding requests with live status badges. Includes a button to open the "New Hire Request" modal flow.
- **My Assets**: Reuses the same concept from the Employee dashboard to display any assets assigned directly to the HR user.
- Excludes all admin stat cards, inventory breakdown, and global activity feeds.

### 5.4 Inventory (`/inventory`)

Per PRD §6.2.

- Sticky search bar at top (300ms debounce, per PRD §6.2.1).
- Filter toolbar directly beneath: scrollable category chips + status dropdown (+ location dropdown, flagged v1.1 in PRD but designed now to slot in without layout change).
- Data table columns exactly as PRD §6.2.3: Category badge · Asset Name (link) · Serial (mono) · Status pill · Location · Assigned To · Assignment Date · Actions.
- Empty state: friendly line-art "empty box" illustration + "No assets found" + "Clear filters" CTA.

### 5.3 Asset Detail (`/inventory/:id`)

Per PRD §6.3. Two-column layout on desktop, stacked on mobile:

- **Left:** Specs Profile card — name, category badge, model, serial (with copy-to-clipboard icon button), cost (`$X,XXX.00`), purchase date, location, inline-editable notes field, status pill.
- **Right:** Assignee Card (if `in-use`) — employee name/email/department, "Google Synced ✓" badge, assignment date — followed by Lifecycle action buttons (Assign/Reassign, Return to Stock, Retire, Delete), with Retire/Delete rendered in the `danger` button variant and gated by a confirmation modal.
- **Below both:** Audit History Timeline — vertical line with a colored dot + icon per event type (Created/Assigned/Returned/Retired), newest first, "Load more" for long histories.

### 5.4 Scanner (`/scanner`)

Per PRD §6.4 — the signature screen.

- Centered viewfinder frame (rounded-corner brackets, like a camera reticle) over either the live `<video>` feed or, when camera is unavailable, a stylized static placeholder with the **animated red laser scanline** sweeping top-to-bottom continuously.
- Below the viewfinder: a **Serial Simulator** dropdown (all existing serials) for demo/dev use — selecting one instantly renders a Scan Result Card (name, model, serial, status, "Go to Asset →" button) or a "No asset found" error state.
- A small toggle in the corner: "Use camera / Use simulator."

### 5.5 Employees (`/employees`)

Per PRD §6.5. Responsive card grid (`grid-cols-4 → 2 → 1`): avatar (photo or initials-fallback in an indigo circle), name, department, location, small Google-verified check badge if synced. Search bar filters by name/email/department. Clicking a card opens the **Employee Asset Drawer** (slide-in panel from the right) listing every asset currently assigned, or an empty state if none.

### 5.6 Categories (`/categories`)

Per PRD §6.6. Card grid: each card shows the badge, name, description, total-assets count, in-use count, and a "View items →" button that deep-links to a pre-filtered Inventory view. A "+ Add Category" card (dashed border, indigo `+` icon) sits at the grid's end and opens the Category Builder modal with a **live badge preview** that updates as the admin types the shortcode and picks a color swatch.

### 5.7 Add Asset (`/add-asset`)

Per PRD §6.7. Single-column form, generous spacing, required fields marked with a red `*` (Rules §8.6): Name, Category (dropdown), Model, Location (dropdown), Cost, Purchase Date (with `YYYY-MM-DD` placeholder), Notes, Serial Number with an inline **"Auto-gen" wand-icon button** that fills the field with a generated `SN-XXX###` code (still editable). A collapsible "Assign to Employee" section at the bottom lets the admin optionally allocate immediately at registration. Submit button disables during submission and the form never clears on a validation error.

### 5.8 Settings (`/settings`)

Per PRD §6.9. Tabbed layout (Google Workspace | Categories):

- **Google Workspace tab:** OAuth config form (Client ID, Domain) with an expandable "How to set this up" accordion; below it, once configured, a "Sync Directory" panel — checklist of directory users (photo, name, email, department), already-synced users greyed out with a disabled checkbox, Select All/Deselect All, a search filter, and a summary toast after sync ("12 added, 3 already existed").
- **Categories tab:** reuses the Category Management Grid from §5.6.

---

## 6. Interaction & Motion

Directly from PRD §9.5 — kept deliberately restrained; the scanner is the one place motion is expressive.

| Element | Motion |
|---|---|
| Scanner laser | Continuous top-to-bottom scanline sweep (CSS keyframe) |
| In-Use status pill | Subtle opacity pulse |
| Modal open/close | Fade + scale, 200ms |
| Card hover | `translateY(-2px)` + shadow increase |
| Activity feed new item | Slide-in from bottom |
| Filter chip toggle | Fill/outline cross-fade, 150ms |
| Metric cards | Count-up animation on first paint |

No other decorative animation is introduced — this is a daily-use operations tool, not a marketing surface.

---

## 7. Responsive Behavior

Per PRD §9.3:

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | < 768px | Sidebar → bottom tab bar (5 primary icons); single-column stacks everywhere; tables become horizontally scrollable |
| Tablet | 768–1024px | Sidebar collapses to icon-only rail; 2-column grids |
| Desktop | > 1024px | Full sidebar with labels; up to 4-column grids |

*Implementation Note (July 2026)*: 
- The bottom tab bar strictly includes the 5 primary views (Dashboard, Inventory, Scanner, Employees, Categories). To prevent crowding, the `Settings` route is moved to the TopBar admin menu on mobile, and `+ Add Asset` is placed prominently in the TopBar as a primary action. 
- For the Inventory table, rather than a full card-based rewrite on mobile, it utilizes horizontal scrollability with an inset edge shadow to preserve column sorting and dense data scanning.
- **Fluid Layout Rules**: Grids must use responsive breakpoints (e.g. `grid-cols-1 sm:grid-cols-2`) rather than hardcoded column counts. SVGs must use a `viewBox` with `w-full h-auto` to scale seamlessly with containers. Text content inside flex containers must specify `min-w-0` and wrapping logic to prevent modal or card blowout.
Minimum tap target on mobile: 44×44px (Rules §8.7).

---

## 8. State Patterns (Loading / Empty / Error)

Per Rules §8.1–§8.3, applied consistently across every list/table/grid/detail view:

- **Loading:** skeleton blocks shaped like the eventual content (never a bare "Loading…" string).
- **Empty:** icon + message + CTA where relevant (e.g., "No assets found — Clear filters", "No employees synced yet — Configure Google Workspace").
- **Error:** message + "Retry" button inline in the component; network-level failures additionally trigger a global offline banner rather than per-component noise.

---

## 9. Accessibility

Per PRD §9.4 and Rules §8.7 — non-negotiable baseline, not a v2 item:

- All interactive elements carry ARIA labels; icon-only buttons always have `aria-label`.
- Status and category are never color-only — always paired with an icon or text.
- Full keyboard navigation (Tab / Enter / Escape); modals trap focus and close on Escape.
- Minimum contrast ratio 4.5:1 (WCAG AA) — verified against the slate-900/slate-100 base pairing and every status color on its pill background.
- Every `<input>` has an associated `<label>`; images carry `alt` (empty `alt=""` for decorative icons).

---

## 10. Example View

A working front-end mockup of the **Dashboard** (the app's landing page, combining the sidebar navigation, metric grid, inventory breakdown, Google Workspace banner, and live activity feed) has been built as an HTML artifact to demonstrate the design system in practice — see `AssetTrack_Dashboard_Mockup.html`.

It shows, live:
- The dark slate + indigo design tokens from §2 rendered as real UI
- The sidebar/topbar layout from §3
- Status pills, category badges, and filter chips per §4
- The Dashboard screen spec from §5.1, populated with realistic seed-style data across the four offices (Bangalore, Mumbai, Delhi, Hyderabad)

---

*End of Document*

**Prepared by:** Design / Frontend Lead
**Review requested from:** Product, Engineering Lead, IT Admin persona
**Next step:** Sign off on tokens (§2) and component library (§4) before Phase 1, Week 1 Tailwind config is written (Phases §3, Week 1).
