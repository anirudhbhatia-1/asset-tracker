# AssetTrack — Technical Architecture Guide

**Document Version:** 2.0  
**Date:** August 5, 2026  
**Stack:** React 18 (Vite) + Node.js / Express 5 + PostgreSQL (Supabase / `pg`)  
**Target Audience:** Software Architects, Lead Developers, System Administrators  

---

## 1. System Overview

AssetTrack is an enterprise IT asset management and hardware lifecycle platform built as a lightweight, high-performance monorepo. The application provides centralized tracking of company-owned and client-provided hardware assets, automated serial number generation, barcode/QR tag scanning, multi-department support ticketing, and new-hire onboarding hardware kit provisioning.

### Technology Stack Summary

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18.x (SPA) | Component-driven user interface with hooks and context state |
| **Build Tooling** | Vite 8.x | Lightning-fast development HMR and production bundle optimization |
| **Styling & UI** | Tailwind CSS 4.x + Lucide Icons | Responsive utility-first design system with dark mode |
| **Backend Runtime** | Node.js (CommonJS) | Asynchronous event-driven JavaScript server environment |
| **Web Framework** | Express 5.x | REST API routing, session middleware, and input validation |
| **Database Engine** | PostgreSQL (Supabase) | Relational persistence with foreign keys, indexes, and transactions |
| **Database Client** | `node-postgres` (`pg`) | Connection pooling and parameterized query execution |
| **Barcode Library** | `@zxing/library` | Client-side webcam video frame extraction and QR/1D decoding |
| **Authentication** | Custom Session Tokens | 32-byte cryptographic hex tokens stored in `sessions` table |

---

## 2. High-Level System Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                        CLIENT (Browser)                          ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │                  React SPA (Vite)                        │    ║
║  │                                                         │    ║
║  │  ┌────────────┐  ┌───────────────┐  ┌────────────────┐ │    ║
║  │  │  UI Views  │  │ ZXing Scanner │  │ Auth State     │ │    ║
║  │  │ (Pages /   │  │ (Webcam API)  │  │ (sessionStore) │ │    ║
║  │  │ Components)│  └───────┬───────┘  └───────┬────────┘ │    ║
║  │  └─────┬──────┘          │                  │          │    ║
║  │        │       HTTP/JSON │    Bearer Token  │          │    ║
║  └────────┼─────────────────┼──────────────────┼──────────┘    ║
║           │                 │                  │               ║
╚═══════════╪═════════════════╪══════════════════╪═══════════════╝
            │  REST API calls │                  │ 
            ▼                 ▼                  ▼
╔═══════════════════════════════════╗   ╔═════════════════════════╗
║   Node.js / Express Backend       ║   ║  Third-Party Services   ║
║                                   ║   ║                         ║
║  ┌──────────────────────────────┐ ║   ║  ┌───────────────────┐  ║
║  │  Route Handlers              │ ║   ║  │ Google Workspace  │  ║
║  │  /api/assets                 │ ║   ║  │ Directory API     │  ║
║  │  /api/employees              │◄╬───╬──│ (Sync Layer)      │  ║
║  │  /api/categories             │ ║   ║  └───────────────────┘  ║
║  │  /api/history                │ ║   ║                         ║
║  │  /api/tickets                │ ║   ║                         ║
║  │  /api/onboarding             │ ║   ║                         ║
║  └──────────────┬───────────────┘ ║   ║                         ║
║                 │                 ║   ╚═════════════════════════╝
║  ┌──────────────▼───────────────┐ ║
║  │  Service Layer               │ ║
║  │  (Business Logic & ExcelJS)  │ ║
║  └──────────────┬───────────────┘ ║
║                 │                 ║
║  ┌──────────────▼───────────────┐ ║
║  │  node-postgres (pg) Driver   │ ║
║  └──────────────┬───────────────┘ ║
║                 │                 ║
╚═════════════════╪═════════════════╝
                  │
        ┌─────────▼─────────────┐
        │   Supabase Postgres   │
        │   (Session Pooler)    │
        └───────────────────────┘
```

---

## 3. Frontend Architecture

### 3.1 Routing & Layout Architecture
The frontend uses `react-router-dom` (v7) with code splitting via React `lazy` and `Suspense`. 

```
App.jsx (Root)
 ├── ThemeProvider (Dark / Light CSS Variables)
 └── BrowserRouter
      └── AuthProvider (User Session State & Token Persistence)
           └── Routes
                ├── /login (Public Unauthenticated Page)
                └── ProtectedRoute (Session Validation Guard)
                     └── MainLayout (TopBar + Sidebar + Toast Container)
                          ├── / (RoleBasedDashboard: Admin / HR / Employee)
                          ├── /profile (All Roles)
                          ├── /tickets (All Roles - Queue Scoped)
                          ├── /inventory/:id (All Roles - Read/Write Scoped)
                          ├── /employees (Admin + HR)
                          ├── /onboarding (Admin + HR)
                          ├── /inventory (Admin Only)
                          ├── /inventory/new (Admin Only)
                          ├── /inventory/:id/edit (Admin Only)
                          ├── /scanner (Admin Only)
                          └── /settings/* (Admin Only)
```

### 3.2 State Management Architecture
State is structured cleanly into three tiers:
1. **Global Authentication State (`AuthContext`)**: Maintains `token`, `user` object (`id`, `email`, `role`, `adminType`), and login/logout handlers backed by `sessionStorage`.
2. **Global Theme State (`ThemeContext`)**: Manages light/dark mode root class toggles and localStorage persistence.
3. **Domain Custom Hooks**: Custom React hooks encapsulating logic for API communications (`useAssets`, `useEmployees`, `useTickets`, `useOnboarding`, `useScanner`, `useMetrics`, `useLocations`).

---

## 4. Backend Architecture

### 4.1 Express Middleware Pipeline
Every request processed by the Express backend passes through a strict sequential middleware pipeline:

```
Incoming Request
   │
   ▼
[1. CORS Middleware] ──► Validates allowed origin headers
   │
   ▼
[2. Express JSON Parser] ──► Parses incoming JSON bodies
   │
   ▼
[3. Morgan Logger] ──► Logs HTTP method, URL, status code, and latency
   │
   ▼
[4. Route Handlers] ──► Executes endpoint controller logic
   │   ├── validateSession ──► Verifies Bearer token in PostgreSQL sessions
   │   ├── requireRole ─────► Enforces RBAC permissions ('admin', 'hr', 'employee')
   │   └── validateRequest ──► Evaluates express-validator constraints
   ▼
[5. Global Error Handler] ──► Catches unhandled errors and returns standard JSON error response
```

---

## 5. Database Schema & Data Architecture

The PostgreSQL database enforces relational integrity using foreign key constraints, indexes, and atomic transaction wrappers (`withTransaction`).

### Table Relationships Overview

1. **`employees`**: Stores staff details, role permissions (`admin`, `hr`, `employee`), system roles (`admin_type`: `it`, `hardware`, `hr`), office location, and bcrypt password hash.
2. **`assets`**: Primary hardware table containing serial numbers, status (`available`, `in-use`, `maintenance`, `retired`), category links, assignee links, warranty specs, purchase costs, and optional self-referencing `parent_id` for accessory links.
3. **`asset_history`**: Immutable, append-only audit trail logging every creation, assignment, return, edit, and retirement event with timestamps and actor IDs.
4. **`tickets`**: Multi-department support tickets routed to `current_admin_type` queues (`it`, `hardware`, `hr`) with status lifecycle (`open`, `in_progress`, `resolved`, `rejected`, `closed`).
5. **`ticket_history`**: Immutable event log tracking ticket transfers between department queues, status transitions, and resolution notes.
6. **`onboarding_requests` & `onboarding_items`**: HR new-hire hardware provisioning kits linking requested asset categories to fulfillment asset IDs.
7. **`locations`**: Global company office locations and JSON address arrays.
8. **`sessions`**: Active authentication sessions storing tokens and 8-hour expiration timestamps.

---

## 6. Security Architecture

- **Token Security**: Sessions generate cryptographically secure 32-byte random hex tokens (`crypto.randomBytes(32)`). Tokens are stored hashed in the `sessions` table and validated on every protected API endpoint.
- **Role-Based Access Control (RBAC)**: Enforced both at API route levels via `requireRole(...)` middleware and in the frontend routing guards.
- **SQL Injection Prevention**: All SQL queries utilize parameterized placeholders (`$1, $2, ...`) executed via `pg.Pool`.
- **Password Security**: Passwords are hashed using `bcrypt` with a minimum salt round factor of 10.
