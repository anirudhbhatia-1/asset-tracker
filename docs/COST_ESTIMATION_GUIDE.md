# AssetTrack — Real-World Cloud vs. Bare Metal Cost Estimation Guide

**Document Version:** 1.0  
**Date:** August 5, 2026  
**Target Audience:** CTOs, IT Directors, Financial Controllers, DevOps Leads  

---

## Executive Summary

This document presents a comprehensive financial and infrastructure cost analysis for deploying and operating the **AssetTrack** platform in production. It compares three primary deployment strategies across two target operational scales:
- **Scale A: 100 Active Users** (~500 Managed Assets)
- **Scale B: 1,000 Active Users** (~10,000 Managed Assets)

### Deployment Strategies Evaluated:
1. **Option 1: Managed Cloud PaaS / Serverless** (Render / Vercel + Supabase Managed DB)
2. **Option 2: Cloud Infrastructure as a Service (IaaS)** (AWS / DigitalOcean / GCP)
3. **Option 3: Bare Metal & On-Premises Servers** (Hetzner / OVH / Local Hardware)

---

## 1. Scale A: Cost Analysis for 100 Active Users (~500 Managed Assets)

At 100 users, traffic is moderate with low compute demands. A single virtual server paired with a managed database provides 99.9% uptime.

### Option 1A: Managed Cloud PaaS (Render + Supabase Pro)
- **Frontend SPA**: Render Static Site (Free Tier) — $0 / mo
- **Backend Express Service**: Render Node.js Web Service (Standard: 1 vCPU, 2 GB RAM) — $14 / mo
- **Managed Database**: Supabase Postgres Pro Plan (8 GB Disk, 2 CPU pooler) — $25 / mo
- **Domain & SSL**: Cloudflare Free Tier — $0 / mo
- **Total Monthly Cost**: **$39.00 / month**
- **Total Annual Cost**: **$468.00 / year**

### Option 2A: Cloud IaaS (DigitalOcean Droplet + Managed DB)
- **Application Server**: DigitalOcean Droplet (2 vCPU, 4 GB RAM, 80 GB NVMe) — $24 / mo
- **Managed Database**: DigitalOcean Managed Postgres (1 vCPU, 2 GB RAM, 25 GB Disk) — $15 / mo
- **Automated Backups**: DigitalOcean Snapshot Storage — $4 / mo
- **Domain & SSL**: Cloudflare Free Tier — $0 / mo
- **Total Monthly Cost**: **$43.00 / month**
- **Total Annual Cost**: **$516.00 / year**

### Option 3A: Bare Metal (Hetzner Cloud / Cloud Server)
- **Bare Metal / Dedicated Virtual Server**: Hetzner CX32 (4 vCPU, 8 GB RAM, 80 GB Disk) — €7.49 / mo (~$8.20 / mo)
- **Offsite Database Backups**: Hetzner Storage Box (100 GB) — €3.20 / mo (~$3.50 / mo)
- **Domain & SSL**: Cloudflare Free Tier — $0 / mo
- **Total Monthly Cost**: **~$11.70 / month** (€10.69 / mo)
- **Total Annual Cost**: **~$140.40 / year**

---

## 2. Scale B: Cost Analysis for 1,000 Active Users (~10,000 Managed Assets)

At 1,000 concurrent users, the application requires horizontal web worker scaling, dedicated connection pooling (PgBouncer), a Redis caching layer, and automated high-availability database backups.

### Option 1B: Managed Cloud PaaS (Render Cluster + Supabase Team)
- **Frontend SPA**: Render / Vercel Pro — $20 / mo
- **Backend Express Cluster**: Render Web Service (3 Instances x 2 vCPU, 4 GB RAM) — 3 x $25 = $75 / mo
- **Redis Cache**: Render Managed Redis (Starter) — $10 / mo
- **Managed Database**: Supabase Team Tier + PgBouncer (8 vCPU, 32 GB RAM, PITR Backups) — $180 / mo
- **Total Monthly Cost**: **$285.00 / month**
- **Total Annual Cost**: **$3,420.00 / year**

### Option 2B: Cloud IaaS (AWS Elastic Beanstalk / EC2 + RDS + ElastiCache)
- **Application Load Balancer (ALB)**: AWS ALB — $25 / mo
- **Web App EC2 Instances**: 3 x AWS `t4g.medium` (2 vCPU ARM64, 4 GB RAM) — $78 / mo
- **Database**: AWS RDS PostgreSQL `db.m6g.large` (2 vCPU, 8 GB RAM, Multi-AZ) — $175 / mo
- **Redis Cache**: AWS ElastiCache `cache.t4g.micro` — $15 / mo
- **CloudWatch & Storage**: S3 Backups + Data Transfer — $25 / mo
- **Total Monthly Cost**: **$318.00 / month**
- **Total Annual Cost**: **$3,816.00 / year**

### Option 3B: Bare Metal Dedicated Server (Hetzner AX41-NVMe)
- **Dedicated Server**: Hetzner AX41-NVMe (AMD Ryzen 5 3600, 64 GB DDR4 RAM, 2 x 512 GB NVMe SSD RAID-1, 1 Gbps unmetered bandwidth) — €39.00 / mo (~$43.00 / mo)
- **Software Stack (Self-Hosted on Server via Docker Compose)**:
  - Nginx Reverse Proxy & SSL Termination
  - Node.js Express Containers (3 Replicas)
  - Redis Container (Caching & Sessions)
  - PostgreSQL 16 DB with PgBouncer Container
- **Offsite Encrypted Backup Storage**: Hetzner Storage Box 1 TB — €3.80 / mo (~$4.20 / mo)
- **Total Monthly Cost**: **~$47.20 / month** (€42.80 / mo)
- **Total Annual Cost**: **~$566.40 / year**

---

## 3. Total Cost of Ownership (TCO) Comparison Matrix

| Infrastructure Strategy | Scale (Users) | Monthly Cost | 1-Year TCO | 3-Year TCO | Maintenance Overhead |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option 1A: Managed Cloud PaaS** | 100 Users | **$39.00** | $468.00 | $1,404.00 | Very Low (Fully Managed) |
| **Option 2A: Cloud IaaS (DigitalOcean)** | 100 Users | **$43.00** | $516.00 | $1,548.00 | Low (Managed DB) |
| **Option 3A: Bare Metal (Hetzner Cloud)** | 100 Users | **$11.70** | $140.40 | $421.20 | Moderate (Self-Administered) |
| **Option 1B: Managed Cloud PaaS** | 1,000 Users | **$285.00** | $3,420.00 | $10,260.00 | Very Low |
| **Option 2B: Cloud IaaS (AWS)** | 1,000 Users | **$318.00** | $3,816.00 | $11,448.00 | Low-Moderate |
| **Option 3B: Dedicated Bare Metal** | 1,000 Users | **$47.20** | $566.40 | $1,699.20 | High (Requires DevOps/SysAdmin) |

---

## 4. Key Takeaways & Recommendations

1. **For Startups / Small Enterprises (100 Users)**:
   - **Recommended Choice**: **Option 1A (Render + Supabase)** at **$39/month**.
   - *Rationale*: Zero DevOps maintenance requirement, automatic SSL certificates, continuous deployment from GitHub, and automated database backups.

2. **For Scale / Cost-Conscious Organizations (1,000 Users)**:
   - **Best Value Choice**: **Option 3B (Dedicated Bare Metal - Hetzner)** at **$47.20/month**.
   - *Rationale*: Delivers massive performance savings (**save > $3,200 / year** compared to AWS) with 64 GB RAM and unmetered gigabit network bandwidth.
   - *Requirement*: Requires a SysAdmin or DevOps engineer proficient in Docker Compose, automated Postgres backups (`pg_dump` to S3/Storage Box), and Nginx reverse proxy configuration.

3. **For Enterprise Compliance / Managed SLA (1,000 Users)**:
   - **Recommended Choice**: **Option 2B (AWS Elastic Beanstalk + RDS Multi-AZ)** at **$318/month**.
   - *Rationale*: Guarantees 99.99% availability SLAs, multi-region failover, automated point-in-time recovery, and SOC2/HIPAA compliance readiness.
