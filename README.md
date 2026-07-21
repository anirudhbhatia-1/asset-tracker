# AssetTrack

A full-stack internal web application for IT asset management across multiple office locations (Bangalore, Mumbai, Delhi, Hyderabad).

## Tech Stack
- **Frontend (`/client`)**: React 18 (Vite), Tailwind CSS, Lucide Icons, Axios, React Router v6
- **Backend (`/server`)**: Node.js, Express, better-sqlite3 (synchronous SQLite), express-validator
- **Database**: SQLite (`/data/assets.db`)

---

## Getting Started

### 1. Prerequisites
- Node.js 20.x LTS or higher
- npm 10.x or higher

### 2. Environment Setup
Copy the example environment files to set up your local environment variables:
```bash
# Backend environment setup
cd server
cp .env.example .env

# Frontend environment setup
cd ../client
cp .env.example .env
```

### 3. Installation & Database Seeding
Install dependencies and seed the SQLite database:
```bash
# Install backend dependencies & initialize/seed database on startup
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 4. Running Locally during Development
Start both dev servers in two separate terminal windows:

**Terminal 1 — Backend API Server (running on port 3001)**:
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend Dev Server (running on port 5173 with API proxy to 3001)**:
```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser to view the application.

---

## Project Structure
```
comppro/ (Monorepo Root)
├── client/          # React Vite frontend
├── server/          # Node.js Express backend
├── data/            # SQLite DB file (assets.db, gitignored)
├── backups/         # DB backups folder (gitignored)
├── .gitignore
└── README.md
```

## Documentation
- `AssetTrack_Memory.md` — Single source of truth & project context
- `AssetTrack_PRD.md` — Product Requirements Document
- `AssetTrack_Architecture.md` — Technical Architecture & API Map
- `AssetTrack_Design.md` — UI/UX Design System & Screen Specs
- `AssetTrack_Rules.md` — Engineering Rules, Standards & AI Boundaries
- `AssetTrack_Phases.md` — Delivery Plan & Week-by-Week Breakdown
