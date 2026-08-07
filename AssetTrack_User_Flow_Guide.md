# AssetTrack — Comprehensive User Flow & Feature Specification Guide

**Document Version:** 1.0  
**Date:** August 4, 2026  
**Stack:** React (Vite) + Node.js / Express + Supabase Postgres  
**Target Audience:** Engineering, Product, QA, and System Administrators  

---

## Table of Contents

1. [Authentication & Login Flow (`/login`)](#1-authentication--login-flow-login)
2. [Layout, Navigation & Sidebar (`Sidebar.jsx`, `TopBar.jsx`)](#2-layout-navigation--sidebar-sidebarjsx-topbarjsx)
3. [Role-Based Dashboard Flow (`/`)](#3-role-based-dashboard-flow-)
4. [Inventory Management Flow (`/inventory`)](#4-inventory-management-flow-inventory)
5. [Add & Edit Asset Form Flow (`/inventory/new`, `/inventory/:id/edit`)](#5-add--edit-asset-form-flow-inventorynew-inventoryidedit)
6. [Asset Detail & Lifecycle Control Flow (`/inventory/:id`)](#6-asset-detail--lifecycle-control-flow-inventoryid)
7. [Employee Directory & Role Management Flow (`/employees`)](#7-employee-directory--role-management-flow-employees)
8. [Ticketing System Flow (`/tickets`)](#8-ticketing-system-flow-tickets)
9. [Onboarding Requests Flow (`/onboarding`)](#9-onboarding-requests-flow-onboarding)
10. [Barcode & QR Tag Scanner Flow (`/scanner`)](#10-barcode--qr-tag-scanner-flow-scanner)
11. [Settings & Administrative Configuration (`/settings`)](#11-settings--administrative-configuration-settings)
12. [User Profile & Password Security Flow (`/profile`)](#12-user-profile--password-security-flow-profile)

---

## 1. Authentication & Login Flow (`/login`)

```
 [User Enters Email & Password] ──► [Click "Sign In"] ──► [POST /api/auth/login]
                                                                │
     ┌──────────────────────────────────────────────────────────┴──────────────────────────┐
     ▼                                                                                     ▼
[Invalid Credentials]                                                            [Success]
 └─► Return 401 Unauthorized                                                      ├─► Issue 32-byte session token (8h expiry)
 └─► Display Red Error Toast                                                      ├─► Save token & user object to sessionStorage
                                                                                  ├─► Set AuthContext React state
                                                                                  └─► Redirect to Root Dashboard (/)
```

### UI Elements & Input Controls
- **Branding Header:** Displays Thinkvibes logo and AssetTrack product subtitle.
- **Form Inputs:**
  - `Email Address` (`type="email"`, required): Corporate email address validation.
  - `Password` (`type="password"`, required): Secured password input field.
- **Action Button:** `Sign In` button featuring an inline loading spinner state during submission.

### User Actions & Backend Processing
1. **Form Submission:** Clicking **Sign In** triggers `handleSubmit`. If email or password is empty, submission is halted and an inline error is rendered.
2. **Network Request:** Sends `POST /api/auth/login` with JSON payload `{ email, password }`.
3. **Database Validation (`authService.js`):**
   - Queries `employees` table for a matching `email` where `password_hash IS NOT NULL`.
   - Compares candidate password against stored hash via `bcrypt.compare()`.
   - If invalid, returns HTTP `401 Unauthorized` with message `"Invalid email or password"`.
4. **Session Generation:**
   - Generates a cryptographically random 32-byte hex token (`crypto.randomBytes(32)`).
   - Inserts row into `sessions` table: `(token, employee_id, expires_at = NOW() + 8 hours)`.
   - Returns HTTP `200 OK` containing `{ token, user: { id, email, role, adminType } }`.
5. **Client State Initialization:**
   - Stores `token` and `user` object in browser `sessionStorage`.
   - Updates React `AuthContext` state.
   - Triggers success toast notification (`"Logged in successfully"`).
   - Programmatically redirects user to `/`.

---

## 2. Layout, Navigation & Sidebar (`Sidebar.jsx`, `TopBar.jsx`)

### Navigation Filtering Matrix
The sidebar dynamically filters links based on `user.role`:

| Navigation Item | Route | Admin | HR | Employee |
|---|---|:---:|:---:|:---:|
| **Dashboard** | `/` | ✅ | ✅ | ✅ |
| **Inventory** | `/inventory` | ✅ | ❌ | ❌ |
| **Tickets** | `/tickets` | ✅ | ✅ | ✅ |
| **Onboarding** | `/onboarding` | ✅ | ✅ | ❌ |
| **Scanner** | `/scanner` | ✅ | ❌ | ❌ |
| **Employees** | `/employees` | ✅ | ✅ | ❌ |
| **Settings** | `/settings` | ✅ | ❌ | ❌ |

### TopBar Controls & Profile Dropdown
- **Sidebar Toggle (Mobile/Tablet):** Hamburger menu button toggles sidebar expansion on screens under `1024px`.
- **Offline Banner:** Automatically slides down if `navigator.onLine` becomes false.
- **Profile Menu Dropdown:**
  - Displays user avatar (or initials fallback), Name, Role badge (`admin`, `hr`, `employee`), and Corporate Email.
  - **"Profile" Link:** Navigates to `/profile`.
  - **"Logout" Button:**
    1. Sends `POST /api/auth/logout` with `Bearer <token>` header.
    2. Backend deletes matching token from `sessions` table.
    3. Client removes `token` and `user` from `sessionStorage`.
    4. Resets `AuthContext` state `user = null`.
    5. Redirects browser to `/login`.

---

## 3. Role-Based Dashboard Flow (`/`)

Upon accessing `/`, the root component evaluates `user.role` and renders the designated dashboard layout:

```
                          [User Navigates to /]
                                   │
                ┌──────────────────┼──────────────────┐
                ▼                  ▼                  ▼
          [role = 'admin']   [role = 'hr']     [role = 'employee']
                │                  │                  │
                ▼                  ▼                  ▼
          <Dashboard />    <HrDashboard />   <EmployeeDashboard />
```

### 3.1 IT Admin Dashboard (`Dashboard.jsx`)
- **Metric Cards Grid:**
  - `Total Assets`: Total physical items in database.
  - `In-Use Assets`: Assets allocated to active employees.
  - `Available Assets`: Unassigned assets ready for deployment.
  - `Retired / Maintenance`: Assets undergoing repair or decommissioned.
  - *Click Interaction:* Clicking any card navigates to `/inventory?status=<status_key>`.
- **Top Actions:**
  - `Refresh Data` button: Re-executes `useMetrics()` and `fetchTickets({ scope: 'all' })`.
  - `New Asset` button: Navigates to `/inventory/new`.
- **Inventory Breakdown Section:**
  - Interactive tab bar: *By Category*, *By Location*, *By Status*, *By Warranty*.
  - Displays visual distribution progress bars and counts for each dimension.
- **Low Stock Category Alert Banner:**
  - Displays alerts for categories where available stock is below minimum threshold.
- **Pending Ticket Queue Table:**
  - Lists latest open/in-progress support tickets with priority badges.
  - *Row Click:* Opens `TicketDetailsModal.jsx`.

### 3.2 HR Dashboard (`HrDashboard.jsx`)
- **HR Metrics Bar:** Shows count of Active Onboardings, Pending Setup, and Completed Setups.
- **New Onboarding Button:** Opens `CreateOnboardingModal.jsx`.
- **Onboarding Request List:**
  - Filter chips: *All*, *Pending*, *Completed*.
  - Displays New Hire Name, Department, Location, Joining Date, Status Pill, and Requested Hardware Checklist.
  - *Action Buttons:* `View Details` (opens `OnboardingDetailsModal.jsx`), `Edit Request` (opens `EditOnboardingModal.jsx`).

### 3.3 Employee Dashboard (`EmployeeDashboard.jsx`)
- **Assigned Hardware Cards:**
  - Cards rendering every laptop, monitor, or headphone assigned to the logged-in employee.
  - Laptop card shows brand, model, serial number, assignment date, and **Warranty Days Left countdown badge** (color-coded).
  - *View QR Tag Button:* Opens `QrTagModal.jsx` to render physical sticker QR code label.
- **My Support Tickets Section:**
  - Shows list of tickets raised by the employee with current resolution status.
  - `Raise New Ticket` button: Opens `CreateTicketModal.jsx`.

---

## 4. Inventory Management Flow (`/inventory`)

```
 [Filter Controls / Search Input] ──► Query Params Updated ──► [GET /api/assets?q=...&category_id=...]
                                                                          │
  ┌───────────────────────────────┬───────────────────────────────────────┴──────────────────────────────┐
  ▼                               ▼                                                                      ▼
[+ Add Asset]             [Export to Excel]                                                       [Import Excel]
 └─► Navigates to          └─► GET /api/assets/export                                              └─► File Picker (.xlsx)
     /inventory/new            └─► Stream .xlsx file download                                            └─► POST /api/assets/import
                                                                                                           └─► Parse & Bulk Create
```

### Search & Multi-Filter Controls
- **Search Field:** Live text input filtering by asset name, model, or serial number (`ILIKE` query).
- **Dropdown Filters:** Category dropdown and Location dropdown.
- **Status Filter Chips:** *All*, *Available*, *In Use*, *Maintenance*, *Retired*.
- **Warranty Filter Chips:** *All*, *Expiring Soon* (within 60 days), *Expired*, *No Warranty*.

### Header Action Buttons
1. **`+ Add Asset`:** Navigates to `/inventory/new`.
2. **`Export to Excel`:**
   - Triggers `GET /api/assets/export`.
   - Backend queries all assets, generates a 4-worksheet workbook (*Laptops*, *Headphones*, *Keyboard Mouse*, *Client Laptops*) using `exceljs`, and streams it as `AssetTrack_Export_YYYY-MM-DD.xlsx`.
3. **`Import Excel`:**
   - Triggers hidden file input restricting extension to `.xlsx`.
   - Uploads file via `POST /api/assets/import` using Multer.
   - Backend parses rows, resolves employee names, checks serial uniqueness, auto-creates parent-child link for adaptor sub-assets, and returns toast summary (`"X created, Y linked"`).

### Asset Grid / Table Actions
- **Row Click / View Details Button:** Navigates to `/inventory/:id`.
- **Edit Button:** Navigates to `/inventory/:id/edit`.
- **Delete / Retire Button:** Prompts confirmation modal. Submitting sends `DELETE /api/assets/:id`, which logs a `deleted` audit event and marks status as `retired`.

---

## 5. Add & Edit Asset Form Flow (`/inventory/new`, `/inventory/:id/edit`)

### Form Structure & Required Fields
- **Core Attributes:**
  - Asset Name (`*`, text): e.g. "MacBook Pro 16".
  - Category (`*`, dropdown): Selects category ID.
  - Ownership Type (`*`, radio): `Company Owned` vs `Client Provided`.
  - Model, Location, Cost ($), Purchase Date (`YYYY-MM-DD`), Notes.
- **Serial Number Field Controls:**
  - Monospace text input field.
  - **Auto-Gen Wand Button (`🪄`):** Generates formatted serial string (e.g. `SN-LP-94821`).
  - **Scan Barcode Button (`📷`):** Opens camera/simulator scanner modal to fill input directly.

### Dynamic Specifications Section
Appears dynamically based on category and ownership selection:

```
 Category Selected ──► Is Laptop? ─────► Show Processor, RAM, Storage, Screen Size, GPU, OS, MS Office
                      ├─► Is Headphone? ──► Show Color, Hardware Type, Warranty Plan
                      └─► Is KB/Mouse? ───► Show Hardware Type, Warranty Plan

 Ownership Type ─────► Client Provided ──► Show Client Name, Received On Date
```

### Parent-Child Sub-Asset Linking
- Allows selecting a parent laptop from dropdown to link sub-assets (e.g. Chargers, Adaptors, Bags) via `parent_id`.

### Assign to Employee Section
- Optional dropdown to select an employee to allocate asset immediately upon creation.

### Submission & Validation
- Sends `POST /api/assets` (or `PATCH /api/assets/:id`).
- Backend executes database insert inside a Postgres transaction, records `created`/`updated` history log, and redirects user to `/inventory`.

---

## 6. Asset Detail & Lifecycle Control Flow (`/inventory/:id`)

```
                                    [Asset Detail View (/inventory/:id)]
                                                     │
         ┌───────────────────────────────────────────┼───────────────────────────────────────────┐
         ▼                                           ▼                                           ▼
[Specs Profile Card]                      [Assignee & Lifecycle Card]                     [Audit History Timeline]
 ├─► Monospace Serial (Copy button)        ├─► Assign / Reassign Button                    └─► Vertical event list
 ├─► Extended specs grid                   │    └─► POST /api/assets/:id/assign                 ├─► Created/Assigned/Returned
 ├─► Warranty Countdown String             ├─► Return to Stock Button                      └─► Absolute date + actor name
 └─► QR Tag Button                         │    └─► POST /api/assets/:id/return
      └─► Opens QrTagModal                 └─► Retire Asset Button
           └─► Print Label Sticker               └─► POST /api/assets/:id/retire
```

### 6.1 Specs Profile Card (Left Panel)
- **Header:** Asset Name, Category Badge, Asset Type Pill (`Company` vs `Client`), Status Pill.
- **Serial Number:** Monospace serial string with **Copy to Clipboard** wand button and **QR Tag** generator button.
- **Financial & Operations:** Cost (`$X,XXX.00`), Purchase Date, Office Location, Address.
- **Warranty Status Badge:** Calculates remaining days live and renders string:
  - `> 60 days`: Green badge (`"X days remaining"`).
  - `1–60 days`: Yellow badge (`"Expiring in X days"`).
  - `< 0 days`: Red badge (`"Expired X days ago"`).
- **Inline Editable Notes:** Pencil button toggles inline text editor to update asset notes directly.

### 6.2 Assignee & Lifecycle Controls (Right Panel)
- **Current Assignee Info:** Avatar, Name, Email, Department, Assignment Date.
- **Lifecycle Action Buttons:**
  1. **`Assign / Reassign`:** Opens employee selector modal. Submitting sends `POST /api/assets/:id/assign`. Updates `assigned_to` and sets status to `in-use`. Inserts `assigned` event in audit history.
  2. **`Return to Stock`:** Sends `POST /api/assets/:id/return`. Clears `assigned_to` and sets status to `available`. Inserts `returned` event in audit history.
  3. **`Retire Asset`:** Sends `POST /api/assets/:id/retire`. Sets status to `retired`. Inserts `retired` event in audit history.

### 6.3 Linked Accessories (Sub-Assets) Panel
- Renders sub-assets linked via `parent_id` (e.g. Charger, USB Adaptor).
- Direct lifecycle buttons on sub-assets are disabled to enforce parent device cascading lifecycle.

### 6.4 Audit History Timeline (Bottom Panel)
- Vertical audit log rendering all historical events (`Created`, `Assigned`, `Returned`, `Retired`, `Updated`).
- Formats timestamps in absolute date/time (`DD/MM/YYYY, H:MM AM/PM`) with actor name.

---

## 7. Employee Directory & Role Management Flow (`/employees`)

```
                              [Employees View (/employees)]
                                            │
                 ┌──────────────────────────┴──────────────────────────┐
                 ▼                                                     ▼
          [Directory Tab]                                   [Role Management Tab]
                 │                                                     │
  ┌──────────────┴──────────────┐                           ┌──────────┴──────────┐
  ▼                             ▼                           ▼                     ▼
[+ Add Employee]         [Row Actions]                 [Current Role]       [Change Role]
 └─► AddEmployeeModal     ├─► Bulk Assign Assets        └─► Display Pill     └─► Select Dropdown
                          ├─► Edit Employee                                     └─► PATCH /api/employees/:id/role
                          ├─► Grant Access / Role
                          ├─► Asset Drawer
                          └─► Soft Delete
```

### 7.1 Directory Tab
- **Filter Controls:** Search bar (Name/Email), Department selector, Location selector, Access status filter (*With Access*, *No Access*).
- **`+ Add Employee` Button:** Opens `AddEmployeeModal.jsx` (Name, Email, Department, Location, Address, Password Access toggle, Google Access button). Submitting sends `POST /api/employees`.
- **Employee Table Row Actions:**
  - **`Assign Hardware`:** Opens `BulkAssignModal.jsx` to select and allocate multiple available assets in one batch (`POST /api/employees/:id/assign-assets`).
  - **`Edit Employee`:** Opens `EditEmployeeModal.jsx`. Sends `PATCH /api/employees/:id`.
  - **`Grant Access / Role`:** Opens `RoleManagementModal.jsx` to configure password credentials or Google login.
  - **`View Assets Drawer`:** Opens `EmployeeAssetDrawer.jsx` (slide-in drawer listing all hardware assigned to employee).
  - **`Delete Employee`:** Sends `DELETE /api/employees/:id`, executing a soft-delete (`deleted_at = NOW()`).

### 7.2 Role Management Tab (`RoleManagementPanel.jsx`)
- Lists all active employee login accounts.
- Displays Employee Name, Email, Department, Current Role badge (`Admin`, `HR`, `Employee`).
- **Role Selector Dropdown:** Changing role sends `PATCH /api/employees/:id/role` with `{ role }` payload, updating user privileges instantly.

---

## 8. Ticketing System Flow (`/tickets`)

### Scope Filtering Tabs
- **Admin / HR View:** *My Queue* (routed to their department), *All Tickets*, *My Raised Tickets*.
- **Employee View:** *My Raised Tickets*.

### Ticket Creation (`CreateTicketModal.jsx`)
1. User clicks **`+ Raise Support Ticket`**.
2. Form Fields:
   - Ticket Type: `Issue / Repair` vs `Hardware Request`.
   - Title (`*`, max 150 chars).
   - Category (dropdown).
   - Linked Asset (dropdown of user's assigned assets).
   - Target Department Queue: `IT Admin`, `Hardware Admin`, `HR Admin`.
   - Detailed Description.
3. Submitting sends `POST /api/tickets`. Backend creates row in `tickets` and inserts initial `created` event in `ticket_history`.

### Ticket Resolution & Management (`TicketDetailsModal.jsx`)
- Displays human-readable ID (`TK-0042`), Type, Requester Info, Target Queue, Status Pill, Timeline.
- **Admin Actions:**
  - Update Status dropdown (*In Progress*, *Resolved*, *Closed*).
  - Enter resolution notes.
  - Option to allocate a resolved asset directly from available stock.
  - Transfer ticket to another admin queue (*IT*, *Hardware*, *HR*).
  - Submitting sends `PATCH /api/tickets/:id` and logs activity in `ticket_history`.

---

## 9. Onboarding Requests Flow (`/onboarding`)

```
 [HR Creates Request] ──► [POST /api/onboarding] ──► [Status: Pending]
                                                            │
                                                            ▼
                                                [Admin Opens Request]
                                                            │
                                                            ▼
                                             [Fulfill Requested Items]
                                              └─► Select available asset
                                              └─► PATCH /api/onboarding/:id/items/:itemId/fulfill
                                                            │
                                                            ▼
                                              [Status: Completed / Arranged]
```

### 9.1 Request Creation (`CreateOnboardingModal.jsx`)
- HR fills New Hire Name (`*`), Email, Department, Location, Address, Joining Date, Hardware Checklist (e.g. Laptop x1, Headphones x1), Notes.
- Submitting sends `POST /api/onboarding`. Creates parent record in `onboarding_requests` and items in `onboarding_items`.

### 9.2 Request Fulfillment (`OnboardingDetailsModal.jsx`)
- Admin opens pending request.
- Status Timeline: `Pending` ➔ `In Progress` ➔ `Arranged` ➔ `Completed`.
- **Fulfill Item Action:** Admin selects an available asset from dropdown for each requested item and submits `PATCH /api/onboarding/:id/items/:itemId/fulfill`.
- Once all items are fulfilled, status updates automatically to `Completed`.

---

## 10. Barcode & QR Tag Scanner Flow (`/scanner`)

### Scanner Viewfinder
- **Webcam Mode:** Uses live camera feed with ZXing decoder reticle.
- **Fallback Laser Mode:** Animated red scanline sweeping top-to-bottom continuously when camera is unavailable.

### Serial Simulator Dropdown
- Select any existing asset serial number from dropdown to simulate physical scanning during testing/demo.

### Scan Result Card
- Successfully decoded serial renders card: Asset Name, Model, Serial, Category Badge, Status Pill, Assignee Name, and a **`Go to Asset Detail →`** deep-link button.
- Unrecognized serial renders an alert: *"No asset found with serial number X"*.

---

## 11. Settings & Administrative Configuration (`/settings`)

### 11.1 Google Workspace Tab
- **OAuth Setup Form:** Configures Client ID and Domain name.
- **Directory Sync Panel:** Displays list of directory users fetched from Google Directory. Already-synced users are greyed out. Submitting sends `POST /api/google/sync` to bulk-create employee profiles.

### 11.2 Categories Tab
- Grid of existing categories (Name, Badge Char, Color Swatch, Total Assets count).
- **`+ Add Category` Card:** Opens Category Builder modal with live badge preview updating as user types shortcode and picks color swatch. Submitting sends `POST /api/categories`.

### 11.3 Locations Tab
- Grid of office locations (e.g., Mumbai, Bangalore) with full address string fields. Submitting sends `POST /api/locations`.

---

## 12. User Profile & Password Security Flow (`/profile`)

### Profile Details Card
- Displays Avatar, Name, Email, Role badge, Department, Location.
- **Edit Name Form:** Submitting sends `PATCH /api/employees/me` to update user's display name.

### Change Password Security Flow
1. User enters `Current Password`, `New Password` (min 8 chars), and `Confirm New Password`.
2. Submitting sends `PATCH /api/auth/change-password`.
3. **Backend Execution (`authService.js`):**
   - Verifies `currentPassword` via `bcrypt.compare()`.
   - Hashes `newPassword` with salt factor 10.
   - Updates `password_hash` in `employees` table inside a transaction.
   - **Deletes all active sessions for that user from `sessions` table:**
     ```sql
     DELETE FROM sessions WHERE employee_id = $1
     ```
4. Client clears `sessionStorage` (`token` and `user`), resets `AuthContext` state, triggers success toast, and redirects user to `/login`.
