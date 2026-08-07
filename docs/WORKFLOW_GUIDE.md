# AssetTrack — Comprehensive Workflow & Feature Guide

**Document Version:** 2.0  
**Date:** August 5, 2026  
**Target Audience:** Engineering, Operations, IT Admins, HR Partners  

---

## 1. Overview of Workflows & User Roles

AssetTrack supports three distinct role levels with customized views and permissions:
- **IT / Hardware Admin (`admin`)**: Full operational access to register hardware, assign/return devices, retire equipment, manage categories/locations, process Excel bulk imports, and resolve IT/Hardware ticket queues.
- **HR Partner (`hr`)**: Access to submit new-hire onboarding hardware requests, view onboarding kit fulfillment progress, edit request details, and manage HR support ticket queues.
- **Employee (`employee`)**: Self-service access to view assigned hardware devices, inspect warranty expiration timers, view device QR tag stickers, submit IT/HR support tickets, and confirm ticket resolutions.

---

## 2. End-to-End Core Workflows

### 2.1 Authentication & Session Workflow
1. User enters corporate email and password on `/login`.
2. Frontend sends `POST /api/auth/login`.
3. Backend checks `employees` table, verifies password hash using `bcrypt.compare()`.
4. Creates a 32-byte hex token in `sessions` table (8-hour expiration).
5. Frontend stores token in `sessionStorage` and initializes `AuthContext`.
6. User is redirected to `/` (Root Dashboard).

---

### 2.2 Asset Registration & Wand Serial Generation Workflow
1. Admin opens `/inventory/new`.
2. Admin inputs Asset Name, selects Category, and chooses Ownership Type (`Company Owned` or `Client Provided`).
3. Admin clicks **Wand Button (`🪄`)** to generate a formatted serial string (e.g. `SN-LP-94821`), or uses **Scan Barcode Button (`📷`)** to decode a physical label via camera/simulator.
4. Admin submits form. Backend executes `POST /api/assets`, writes record to `assets` table, and logs a `created` event in `asset_history`.

---

### 2.3 Asset Assignment & Return-to-Stock Workflow

```
[Available Asset] ──► Assign to Employee ──► Status: 'in-use' ──► Log 'assigned' event in asset_history
         ▲                                                                   │
         └────────────────── Return to Stock ────────────────────────────────┘
```

1. **Assignment**: From `/inventory/:id`, Admin opens `AssignmentModal`, selects active employee and assignment date. Backend updates asset `assigned_to` and status to `in-use`, sending an automated notification to the employee.
2. **Return to Stock**: Admin clicks `Return to Stock`. Backend sets `assigned_to = NULL`, clears `assigned_date`, and updates status to `available`.

---

### 2.4 Maintenance & Retirement Workflow
1. Admin selects `Retire Asset` or `Mark Maintenance`.
2. Admin enters retirement reason or service notes.
3. Backend updates status to `retired` or `maintenance`, clears assignee links, and records an append-only event in `asset_history`.

---

### 2.5 Multi-Worksheet Bulk Excel Import/Export Workflow

```
                          [Export Action]
  GET /api/assets/export ──► Queries assets with full joins
                         ──► Generates 4-sheet .xlsx workbook (ExcelJS)
                         ──► Streams download to client

                          [Import Action]
  POST /api/assets/import ──► Uploads .xlsx file via Multer
                          ──► Parses Sheets: Laptops, Headphones, Keyboard Mouse, Client Laptops
                          ──► Resolves employee names & category IDs
                          ──► Auto-creates parent-child link for Adaptor S/N
                          ──► Inserts records atomically in SQL transaction
```

---

### 2.6 HR New-Hire Onboarding Kit Request Workflow
1. HR Partner navigates to `/onboarding` or `/` (HR Dashboard).
2. Clicks `+ New Hire` to open `CreateOnboardingModal`.
3. Inputs New Hire Name, Personal Email, Department, Location, Joining Date, and adds dynamic hardware requirements (`[{ categoryId, quantity, notes }]`).
4. Submits request. Request is created with status `pending`.
5. Admin opens `OnboardingDetailsModal`, reviews requested categories, selects in-stock assets to fulfill each item, and updates status through `in_progress` ──► `arranged` ──► `completed`.

---

### 2.7 Multi-Department Support Ticketing Workflow

```
[Employee Raises Ticket] ──► Selects Queue (IT / Hardware / HR)
                                        │
    ┌───────────────────────────────────┼──────────────────────────────────┐
    ▼                                   ▼                                  ▼
[IT Queue]                        [Hardware Queue]                    [HR Queue]
    │                                   │                                  │
    └───────────────────► Inter-Admin Ticket Transfer ◄────────────────────┘
                                        │
                                        ▼
                          [Admin Resolves Ticket]
                                        │
                                        ▼
                  [Employee Confirms Resolution OR Reopens]
```

1. **Ticket Raising**: Employee clicks `Raise Ticket` on `/tickets` or `/` (Employee Dashboard), selecting type (`issue` or `request`), description, and target department (`IT`, `Hardware`, `HR`).
2. **Queue Routing**: Ticket is assigned `current_admin_type` and appears in that admin team's queue (`my_queue`).
3. **Inter-Department Transfer**: If an IT admin receives a ticket intended for HR or Hardware, they select `Transfer Ticket`, enter a transfer reason, and set new `targetAdminType`. Backend updates `current_admin_type` and logs a `transferred` event in `ticket_history`.
4. **Resolution & Confirmation**: Admin marks ticket `resolved` with notes. Employee receives notification and can either click `Confirm Resolution` (status changes to `closed`) or `Reopen Ticket` with feedback.

---

### 2.8 Barcode & QR Tag Scanning Workflow
1. Admin or Employee opens `/scanner` or device QR modal (`QrTagModal.jsx`).
2. **Webcam Mode**: Camera feed streams live video frames to `@zxing/library` decoder reticle. Upon detecting a 1D barcode or 2D QR matrix, the decoded serial is sent to `GET /api/serial/:serialNumber`.
3. **Simulator Fallback**: If camera permission is denied or webcam is unavailable, user selects serial from dropdown or types serial in `SerialSimulator.jsx` to test decoding workflows.
4. **Match Result**: `ScanResultCard.jsx` renders matched asset name, status, category badge, and direct link button to `/inventory/:id`.
