# AssetTrack — User Scaling & Architectural Evolution Guide (1 ➔ 100 ➔ 1,000 Users)

**Document Version:** 1.0  
**Date:** August 5, 2026  
**Target Audience:** Infrastructure Engineers, DevOps, System Architects  

---

## Executive Summary

This document evaluates the system behavior, performance characteristics, bottleneck analysis, and required architectural evolutions as AssetTrack scales from a **single-user local developer sandbox (1 User)** to a **small-to-medium enterprise installation (100 Users)** and finally an **enterprise-wide high-concurrency multi-region deployment (1,000 Users)**.

---

## 1. Stage 1: Single User Sandbox (1 User / Local Development)

### 1.1 Deployment Topology
- **Client**: Vite Dev Server / Local SPA running in browser (`localhost:5173`).
- **Server**: Single Node.js Express process (`localhost:3001`).
- **Database**: Supabase / Direct PostgreSQL instance.

### 1.2 Performance & System Characteristics
- **Total Concurrent Users**: 1
- **Managed Assets Count**: ~10–50 items.
- **Server Memory Footprint**: ~80 MB – 150 MB RAM (Node.js single process).
- **Database Memory Footprint**: ~50 MB – 100 MB RAM.
- **Latency Profile**: < 15ms for REST API queries; < 5ms for local state transitions.

### 1.3 Architecture Characteristics & Bottlenecks
- Zero network latency overhead.
- In-memory Node.js event loop capacity is > 99.9% idle.
- Simple single-process `pg.Pool` with `max: 10` connections is more than sufficient.

---

## 2. Stage 2: Small to Medium Enterprise (100 Active Users / ~500–1,000 Managed Assets)

### 2.1 Deployment Topology
- **Deployment Model**: Single Virtual Private Server (VPS) or Containerized Service (e.g. Render / DigitalOcean Droplet / AWS EC2 `t3.medium`).
- **Specifications**: 2 vCPU, 4 GB RAM.
- **Web Server / Reverse Proxy**: Nginx acting as SSL termination proxy and static file server for Vite build artifacts (`dist/`).
- **Database**: Cloud Managed PostgreSQL (e.g., Supabase DB / AWS RDS PostgreSQL / DigitalOcean Managed Postgres).

```
   [100 Client Browsers / Mobile Devices]
                    │
                    ▼ (HTTPS Port 443)
          ┌───────────────────┐
          │  Nginx Web Server │ ── Serves static React JS/CSS SPA assets
          └─────────┬─────────┘
                    │ (Reverse Proxy Port 3001)
                    ▼
          ┌───────────────────┐
          │ Node.js / Express │ ── 1 Single Node Instance (PM2)
          └─────────┬─────────┘
                    │ (pg.Pool: max 20 connections)
                    ▼
          ┌───────────────────┐
          │ PostgreSQL Database│ ── Managed Postgres DB (2 vCPU, 4GB RAM)
          └───────────────────┘
```

### 2.2 Performance Metrics & Load Estimates
- **Active Concurrent Connections**: 15–30 peak concurrent requests/sec.
- **Managed Assets**: 500 – 2,000 hardware devices.
- **Daily Operations**: ~20 asset allocations, ~15 onboarding requests, ~25 support tickets.
- **Response Latency Target**: 95th percentile < 120ms.

### 2.3 Required System Optimizations at 100 Users
1. **Database Indexing Strategy**:
   Ensure all high-frequency filter columns have explicit PostgreSQL B-tree indexes:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(assigned_to);
   CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
   CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON assets(serial_number);
   CREATE INDEX IF NOT EXISTS idx_tickets_employee_id ON tickets(employee_id);
   CREATE INDEX IF NOT EXISTS idx_tickets_admin_type_status ON tickets(current_admin_type, status);
   CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
   ```
2. **PostgreSQL Connection Pool Tuning**:
   Configure Node.js `pg.Pool` parameters in `server/db.js`:
   ```javascript
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20,                  // Allow up to 20 concurrent pool sockets
     idleTimeoutMillis: 30000,  // Release idle sockets after 30s
     connectionTimeoutMillis: 5000,
   });
   ```
3. **Session Expiry & Database Cleanup**:
   Automate periodic cleanup of expired tokens from the `sessions` table to prevent table bloat:
   ```sql
   -- Scheduled cron task running daily
   DELETE FROM sessions WHERE expires_at < NOW();
   ```
4. **Client-Side Production Build**:
   Compress static assets using Vite manual chunk splitting to keep main bundle size < 350 KB:
   ```javascript
   // vite.config.js
   export default defineConfig({
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom', 'react-router-dom'],
             lucide: ['lucide-react'],
             zxing: ['@zxing/library']
           }
         }
       }
     }
   });
   ```

---

## 3. Stage 3: Enterprise Scale (1,000 Active Users / ~10,000+ Managed Assets)

### 3.1 Deployment Topology
At 1,000 concurrent active employees (and 10,000+ hardware devices), single-instance Node.js servers and raw database queries will experience thread pool starvation during peak shift starts (e.g. 9:00 AM login bursts) or large Excel import/export streams.

The system scales to a **Distributed Microservices/Horizontal Pod Architecture**:

```
                       [1,000+ Client Browsers / Barcode Devices]
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │  Cloudflare CDN & Web Application FW  │
                       └───────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌───────────────────────────────────────┐
                       │  AWS Application Load Balancer (ALB) │
                       └───────────────────┬───────────────────┘
                                           │
               ┌───────────────────────────┼───────────────────────────┐
               ▼                           ▼                           ▼
    ┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
    │ Express Instance 1 │      │ Express Instance 2 │      │ Express Instance 3 │  (Horizontal Pod
    └──────────┬─────────┘      └──────────┬─────────┘      └──────────┬─────────┘   Autoscaling HPA)
               │                           │                           │
               └───────────────────────────┼───────────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
                    ▼                                             ▼
         ┌─────────────────────┐                       ┌─────────────────────┐
         │ Redis Cache Cluster │                       │  PgBouncer Pooler   │
         │ (Sessions/Metrics)  │                       │  (Connection Mgr)   │
         └─────────────────────┘                       └──────────┬──────────┘
                                                                  │
                                            ┌─────────────────────┴─────────────────────┐
                                            ▼                                           ▼
                                 ┌────────────────────┐                      ┌────────────────────┐
                                 │ Primary Postgres DB│                      │ Read Replica DB    │
                                 │ (Writes / Mutate)  │                      │ (Search / Reports) │
                                 └────────────────────┘                      └────────────────────┘
```

### 3.2 Key Bottlenecks at 1,000 Users & Architectural Solutions

| Bottleneck Component | System Impact | Architectural Solution |
| :--- | :--- | :--- |
| **Node.js Single Thread Limit** | Event loop lag during Excel parsing or heavy JSON serialization | Run multi-instance Express cluster via PM2 or Kubernetes HPA with round-robin load balancing. |
| **PostgreSQL Connection Exhaustion** | 1,000 client instances polling metrics will crash Postgres connection limits | Deploy **PgBouncer** in transaction pooling mode to multiplex thousands of client connections into 50 DB sockets. |
| **Excel Export Stream Block** | Exporting 10,000 assets to Excel freezes Node.js CPU | Offload Excel generation to asynchronous background worker queues using **BullMQ + Redis**. |
| **Database Read Traffic** | Frequent metric aggregation queries (`COUNT(*)`, `GROUP BY`) slow down asset writes | Implement **Redis Caching Layer** for metrics (TTL: 60s) and route read queries to PostgreSQL **Read Replicas**. |
| **Session Verification DB Overhead** | Checking PostgreSQL `sessions` on every HTTP request creates 1,000 DB reads/sec | Cache active session tokens in Redis (`SETEX session:token 28800 userId`). Validations hit Redis in < 1ms. |
| **Audit History Table Bloat** | `asset_history` grows to millions of rows | Implement **PostgreSQL Table Partitioning** by year (`PARTITION BY RANGE (event_at)`). |

---

## 4. Summary Matrix: Architecture by User Scale

| Feature / Metric | 1 User (Local) | 100 Users (SMB) | 1,000 Users (Enterprise) |
| :--- | :--- | :--- | :--- |
| **App Instance** | 1 Node.js Process | 1 VPS Instance (2 vCPU) | Cluster / Kubernetes (3–8 Instances) |
| **Database Tier** | Local Postgres / Supabase Free | Managed Postgres (2 vCPU, 4GB) | Primary Write DB + Read Replica + PgBouncer |
| **Session Store** | Postgres `sessions` Table | Postgres `sessions` Table + Daily Cron | Redis Memory Cache Cluster |
| **Caching Layer** | None | Browser HTTP Cache | Redis (Metrics, Categories, Sessions) |
| **Excel Processing** | Synchronous Express Stream | Synchronous Express Stream | Asynchronous Worker Queue (BullMQ) |
| **Estimated Monthly Cost** | $0 | ~$39 – $75 / month | ~$250 – $550 / month |
