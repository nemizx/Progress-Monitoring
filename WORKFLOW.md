# Planedge Monitors — Project Workflow Guide

Construction progress monitoring application for residential/commercial projects. This document describes the **end-to-end workflow**, module flows, data relationships, and how to run the system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [How to Run](#2-how-to-run)
3. [Authentication Workflow](#3-authentication-workflow)
4. [Master End-to-End Workflow](#4-master-end-to-end-workflow)
5. [Module Workflows](#5-module-workflows)
6. [Standard WBS Template](#6-standard-wbs-template)
7. [Data Model & Relationships](#7-data-model--relationships)
8. [User Roles](#8-user-roles)
9. [Navigation Map](#9-navigation-map)

---

## 1. System Overview

| Layer | Technology | Port |
|-------|------------|------|
| Frontend | React + Vite | **5173** |
| Backend API | Node.js + Express | **3000** |
| Database | PostgreSQL 15 | **5432** |

**Docker services:** `planedge_frontend`, `planedge_backend`, `planedge_db`

**Default admin login:**
- Email: `admin@planedge.co`
- Password: `adminpassword`

---

## 2. How to Run

### Option A — Docker (recommended)

```bash
docker compose up
```

Open: **http://localhost:5173** (not 1573 or other ports)

### Option B — Local development

```bash
npm install
npm run db:setup    # first time / reset schema
npm run dev         # starts frontend (:5173) + backend (:3000)
```

**Requirements:** PostgreSQL running locally with credentials in `server/.env` (defaults: `postgres` / `password` / `progress_monitoring`).

---

## 3. Authentication Workflow

```
┌─────────────┐     login/register      ┌──────────────┐
│  /login     │ ──────────────────────► │  JWT token   │
│  /register  │                       │  stored in   │
└─────────────┘                       │  localStorage│
                                      └──────┬───────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  Protected routes        │
                              │  (Dashboard, Projects,   │
                              │   WBS, Schedule, etc.)   │
                              └──────────────────────────┘
```

**Steps:**
1. User opens `/login` or `/register`
2. Backend validates credentials → returns JWT + user profile
3. Token sent on every API call via `Authorization: Bearer <token>`
4. Expired/invalid token → redirect to `/login` (stale tokens are cleared)
5. Logout clears token and returns to login page

---

## 3.1 Global Scope Rule: Project → Sub Project

**Every operational module requires two selections before data and actions appear:**

```
Select Project  →  Select Sub Project  →  Features unlock
```

| Component | Location | Role |
|-----------|----------|------|
| `useProjectSubProject` | `src/hooks/useProjectSubProject.js` | Shared state + queries |
| `ProjectSubProjectSelector` | `src/components/shared/` | Project + Sub Project dropdowns |
| `SubProjectGate` | `src/components/shared/` | Empty state until both are selected |
| `subProjectScope.js` | `src/lib/` | Filter WBS, budget, activities, progress by sub-project |

**Pages using this pattern:**

| Page | Route |
|------|-------|
| WBS Management | `/wbs` |
| Budget & Cost | `/budget` |
| Cost Controls | `/cost-controls` (setup tab works at project level) |
| Schedule Builder | `/scheduler` |
| Schedule Monitor | `/schedule-monitor` |
| Site Progress (DPR) | `/progress` |
| Collaboration & Changes | `/collaboration` |
| Labor Tracking | `/attendance` |
| Reports & Analytics | `/reports` |
| Smart Scheduler | `/smart-scheduler` |
| Quality Management | `/quality` |

**Exceptions (no sub-project gate):**
- **Dashboard** — portfolio-level overview across projects
- **Projects** — create/manage projects and sub-projects at source

**Setup reminder:** Sub-projects are created under **Projects → [Project] → Sub Projects** or **Cost Controls → Sub-Projects & Flats** tab.

---

## 4. Master End-to-End Workflow

This is the recommended order to set up and operate a construction project in the app.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROJECT SETUP (One-time)                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
   ① CREATE PROJECT          Admin → Projects → New Project
         │
         ▼
   ② ADD SUB-PROJECTS        Projects → [Project] → Sub Projects tab
         │                   (Tower A, Block B, Phase 1, etc.)
         │                   Optional: Floors × Flats → auto-creates flat records
         ▼
   ③ CONFIGURE STANDARD WBS  WBS → Project WBS tab
         │                   Select Project → Select Sub Project
         │                   → Apply Standard WBS (68 items: 16 L1 + 52 L2)
         ▼
   ④ BUILD SCHEDULE          Schedule → Schedule Builder
         │                   Select project → Select sub-project → Add/link activities
         │                   Optional: AI Schedule Wizard
         ▼
   ⑤ SET UP BUDGET           WBS → Budget
         │                   L1 budget heads → L2/L3 line items
         │                   Link budget items to WBS items
         ▼
   ⑥ COST CONTROLS           WBS → Cost Controls
         │                   MEP BOQ → Link activities to budget
         │                   Generate L3 budget from flats × BOQ rates
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DAILY / ONGOING OPERATIONS                           │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ├──► ⑦ SITE PROGRESS      Progress → Daily progress sheet (DPR)
         │                        Log quantities, weather, L1/L2/L3 updates
         │
         ├──► ⑧ SCHEDULE MONITOR   Schedule → Schedule Monitor
         │                        Track activity status, log progress, sub-tasks
         │
         ├──► ⑨ LABOR TRACKING     Attendance → select project + sub-project
         │
         ├──► ⑩ REPORTS           Analytics → Reports / Analytics
         │
         └──► ⑪ DASHBOARD          Overview of all projects, milestones, alerts
```

---

## 5. Module Workflows

### 5.1 Projects (`/projects`)

**Purpose:** Create and manage top-level construction projects.

| Action | Steps |
|--------|-------|
| Create project | Projects → **New Project** → fill name, location, client, dates, budget |
| View details | Click a project card → opens **Project Detail** |
| Sub Projects | Project Detail → **Sub Projects** tab → **Add Sub Project** |
| Milestones | Project Detail → **Milestones** tab → add/track phase milestones |
| Settings | Project Detail → **Admin** tab → edit project metadata, assign users |

**Sub Project fields:**
- Name (required) — e.g. Tower A
- Built-up Area (sqft) — optional
- Floors / Flats per Floor — optional; if both > 0, flat records are auto-generated

---

### 5.2 WBS Management (`/wbs`)

**Purpose:** Work Breakdown Structure — hierarchical work packages per sub-project.

**Flow: Project → Sub Project → WBS**

| Step | Action |
|------|--------|
| 1 | Open **WBS Management** → **Project WBS** tab |
| 2 | Select **Project** |
| 3 | Select **Sub Project** |
| 4 | WBS table appears (or empty state) |
| 5 | **Apply Standard WBS** — loads 68-item template for this sub-project |
| 6 | Or **Add WBS Item** manually (L1 / L2 / L3) |
| 7 | Edit items → link to Schedule Activity and Budget Item |

**Standard Template tab:** Global 68-item WBS format (admin can edit). Same template applied to each sub-project independently.

**WBS ID format:** `1`, `1.1`, `1.2`, `5.4` (16 L1 categories + 52 L2 sub-items)

---

### 5.3 Schedule Builder (`/scheduler`)

**Purpose:** Define schedule activities linked to WBS.

| Action | Steps |
|--------|-------|
| Select scope | Select **Project**, then **Sub Project** |
| Add activity | **Add Activity** → link WBS item, set dates, phase, dependencies |
| AI generation | **Schedule Wizard** → project params → generate draft schedule |
| Review | **Schedule Review** → approve/finalize generated schedule |
| Edit | Update status, progress, critical path, crew, labor count |

**Phases:** foundation, structure, mep, finishing, handover, other

**Dependencies:** FS (Finish-to-Start) with predecessors/successors JSON arrays

---

### 5.4 Schedule Monitor (`/schedule-monitor`)

**Purpose:** Field execution — update activity status and log daily progress.

| Action | Steps |
|--------|-------|
| Select scope | Select **Project**, then **Sub Project** |
| View activities | Filtered to sub-project WBS scope |
| Update status | not_started → in_progress → completed |
| Log progress | Open activity → daily progress report sheet |
| Sub-tasks | Break activities into schedule tasks |
| Budget heads | Map activities to 16 standard budget head codes |

---

### 5.5 Budget & Cost (`/budget`, `/cost`)

#### Budget (`/budget`)

| Action | Steps |
|--------|-------|
| Select project | Filter budget tree by project |
| L1 heads | Top-level budget categories (01-PRE through 16-MIS) |
| L2/L3 items | Child line items with quantity, rate, unit |
| Link WBS | Each budget item can reference a WBS item |
| Upload | Import budget from spreadsheet (Budget Upload Panel) |
| Track | Original / revised / committed / actual / forecast costs |

#### Cost Controls (`/cost`)

| Tab | Purpose |
|-----|---------|
| Sub Projects | Manage towers/blocks + flat breakdown |
| MEP BOQ | Define MEP activities with rates per flat/floor |
| Flat Matrix | View flats by floor for selected sub-project |
| L3 Generator | Auto-generate L3 budget from flats × BOQ |
| Activity Linker | Fuzzy-match schedule activities to budget items |

**Typical Cost Controls flow:**
1. Select project
2. Configure sub-projects (if not done in Projects)
3. Add MEP BOQ baseline activities
4. Link schedule activities to budget items
5. Run **Generate L3 Budget**

---

### 5.6 Site Progress (`/progress`)

**Purpose:** Daily Progress Reports (DPR) and periodic reports.

| Tab | Purpose |
|-----|---------|
| Progress Sheet | Daily quantity logging against budget/WBS hierarchy |
| WPR | Weekly Progress Report |
| MPR | Monthly Progress Report |
| History | Past submitted entries |

**Flow:**
1. Select project
2. Choose L1 → L2 → L3 budget/WBS hierarchy
3. Enter planned vs actual quantities for the day
4. Set weather condition, submitted by
5. Submit → creates ProgressEntry records → updates WBS progress

---

### 5.7 Dashboard (`/`)

**Purpose:** Executive overview across all projects.

**Shows:**
- Active projects count, average progress
- Labor attendance (present/absent) with date + project filters
- Quality inspection scores
- Delayed/blocked milestones
- Phase distribution chart
- WBS health panel
- Unread notifications

---

### 5.8 Reports & Analytics (`/reports`, `/analytics`)

**Purpose:** Reporting views (Analytics currently reuses Reports page).

Export and visualize project KPIs, progress trends, budget variance.

---

### 5.9 Collaboration (`/collaboration`)

**Purpose:** Change events and team communication posts.

Track change orders, RFIs, and collaboration threads per project.

---

### 5.10 Notifications (`/notifications`)

**Purpose:** In-app alerts (unread filter, mark as read).

Accessible from sidebar bell icon.

---

### 5.11 Admin Panel (`/admin`)

**Purpose:** System administration (admin role).

| Tab | Actions |
|-----|---------|
| Users | Invite users by email + role |
| Documents | Upload project documents (drawings, specs, reports) |
| Settings | System configuration |

**Document categories:** drawing, method_statement, schedule, report, specification, approval, other

---

### 5.12 Labor Tracking (`/attendance`)

**Purpose:** Record daily worker attendance by project, trade, and status (present/absent/half-day).

Feeds into Dashboard attendance metrics.

---

## 6. Standard WBS Template

Global template stored in `wbs_template_items` table. Seeded with **68 items**:

- **16 L1 categories** — Earth Work, RCC Work, Masonary & Plaster, etc.
- **52 L2 sub-items** — e.g. `1.1`, `1.2`, `5.4`

| Admin action | Location |
|--------------|----------|
| View/edit template | WBS → **Standard Template** tab |
| Load default data | **Load Standard Data** (admin only) |
| Apply to sub-project | WBS → Project WBS → select Project + Sub Project → **Apply Standard WBS** |

**Apply modes:**
- **Merge** — add missing items, keep existing
- **Replace** — delete sub-project WBS first, then apply fresh

---

## 7. Data Model & Relationships

```
users
  └── projects (created_by_id)
        ├── sub_projects
        │     ├── project_flats (floor × flat grid)
        │     └── wbs_items (sub_project_id)  ◄── per sub-project WBS
        ├── wbs_items (also linked via project_id)
        ├── schedule_activities ──► wbs_items
        ├── budget_items ──► wbs_items
        ├── milestones
        ├── progress_entries ──► budget_items
        ├── attendance_entries
        ├── quality_inspections
        ├── documents
        ├── change_events
        ├── collaboration_posts
        ├── notifications
        └── mep_boqs (Cost Controls BOQ)

wbs_template_items (global, not per-project)
```

**Key links:**
| From | To | Purpose |
|------|-----|---------|
| WBS Item | Schedule Activity | Schedule ↔ work package |
| WBS Item | Budget Item | Cost ↔ work package |
| Schedule Activity | Budget Item | Cost Controls activity linking |
| Progress Entry | Budget Item | DPR quantity tracking |
| Sub Project | WBS Items | Scoped WBS per tower/block |
| Sub Project | Project Flats | Flat-level cost breakdown |

---

## 8. User Roles

| Role | Typical access |
|------|----------------|
| `admin` | Full access, WBS template edit, user invite, admin panel |
| `planning_team` | Schedule, WBS, budget setup |
| `project_manager` | Project oversight, reports |
| `site_engineer` | Progress logging, schedule updates |
| `department_head` | Department-level views |
| `management` | Dashboard, analytics |

---

## 9. Navigation Map

```
Planedge_Monitors (Sidebar)
│
├── Dashboard                    /
├── Progress                     /progress
├── Schedule
│   ├── Schedule Builder         /scheduler
│   └── Schedule Monitor         /schedule-monitor
├── Analytics
│   ├── Reports                  /reports
│   └── Analytics                /analytics
├── WBS
│   ├── WBS                      /wbs
│   ├── Budget                   /budget
│   └── Cost Controls            /cost
├── Admin
│   ├── Administration           /admin
│   └── Projects                 /projects
├── Collaboration                /collaboration
└── Notifications                /notifications
```

---

## Quick Reference — New Project Checklist

- [ ] Create project under **Projects**
- [ ] Add sub-projects (Tower A, B, …) under **Projects → Sub Projects**
- [ ] Apply standard WBS per sub-project under **WBS Management**
- [ ] Build schedule under **Schedule Builder** (link activities to WBS)
- [ ] Set up L1/L2 budget under **Budget**
- [ ] Configure MEP BOQ + flat matrix under **Cost Controls**
- [ ] Link schedule activities to budget in **Cost Controls**
- [ ] Generate L3 budget from flats
- [ ] Begin daily progress logging under **Progress**
- [ ] Monitor execution under **Schedule Monitor**
- [ ] Review KPIs on **Dashboard**

---

*Last updated: June 2026 — reflects Project → Sub Project → WBS flow and Docker/local setup.*
