# DCO Contract Management System

**Live Site:** https://0n11san.github.io/dco-app-demo/

A web-based contract management dashboard for Army Defensive Cyber Operations (DCO) / ARCYBER. Built as a demonstration application with static HTML/CSS/JS on GitHub Pages and a Cloudflare Worker + D1 (SQLite) backend.

## Features

### Contract Dashboard
- Full contract inventory with 24 seeded delivery orders
- Role-based access: superusers see all columns (costs, vendor info, documents); regular users see non-sensitive fields only
- Add, edit, and delete contracts (superuser only)
- Bulk upload via CSV or Excel
- Export to CSV or Excel
- Tooltips on all column headers explaining each field
- Detail modal with cost breakdown, line items, capability description, and document links

### Renewal Tracker
- Auto-populates contracts within 120 days of PoP end
- Color-coded urgency: red (overdue), orange (0–14 days), yellow (15–30 days), green (30+ days)
- 45-day minimum lead time banner with explanation of required contracting steps
- Suspense date column (PoP End minus 45 days)
- Renewal decision modal: validators submit **Renew** or **Sunset** with mandatory quantity, justification, and capability feedback
- Once a decision is submitted, automated notifications are suppressed for that contract

### Activity Log *(superuser only)*
- Tracks every create, update, delete, and renewal decision
- Filterable by action type and contract name

### Email Notification Demo *(superuser only)*
- Previews the automated renewal notification emails that validators would receive at 120, 90, and 60 days
- Currently in demo mode (no emails sent); ready to activate with a Resend API key

## Demo Credentials

| Username | Password | Role |
|---|---|---|
| `APM` | `Dco2025!` | Superuser |
| `ChiefNeely` | `Dco2025!` | Regular user |

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Static HTML / CSS / JS — GitHub Pages |
| Backend API | Cloudflare Worker (dco-worker) |
| Database | Cloudflare D1 (SQLite) |
| Email (planned) | Resend API via Worker |

No GitHub token is required to use the application. All data reads and writes go through the Cloudflare Worker.

## Backend

Worker URL: `https://dco-worker.jon-ev-smi.workers.dev`

### API Endpoints

| Method | Path | Access |
|---|---|---|
| GET | `/api/contracts` | All users |
| POST | `/api/contracts` | Superuser |
| PUT | `/api/contracts/:id` | Superuser |
| DELETE | `/api/contracts/:id` | Superuser |
| POST | `/api/contracts/:id/renewal` | All users |
| GET | `/api/audit-log` | Superuser |
| GET | `/api/email-preview/:id` | Superuser |

## Column Reference

| Column | Description |
|---|---|
| Delivery Order Name | Name of the delivery order or primary vendor/software |
| DO # | Official delivery order number from the contracting office |
| Vendor POC(s) | Primary vendor point(s) of contact |
| BA8 Portion | Budget Activity 8 funded portion |
| ARCYBER Portion | ARCYBER-funded portion |
| ITEMS Fee (1%) | Administrative fee via the ITEMS contracting vehicle |
| GSA Fee (2%) | GSA Schedule fee |
| Total Current Cost | Total obligated cost inclusive of all fees |
| Projected Next FY | Estimated cost for the upcoming fiscal year |
| POR(s) Supported | Program(s) of Record this contract supports |
| POR Funded By | Program of Record providing the funding |
| Vehicle | Contracting vehicle (CHESS ITES-4H hardware / CHESS ITES SW software) |
| Facilitated By | Organization facilitating the contract action |
| Sunsetting? | Whether this contract will lapse at PoP end |
| Primary Metric | Primary performance metric (endpoints, seats, cores, etc.) |
| PoP Begin / End | Period of Performance dates |

---

*UNCLASSIFIED // FOR OFFICIAL USE ONLY — Demo application with fictional data.*
