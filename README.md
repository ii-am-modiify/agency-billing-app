# Billing Automation System

Clinical timesheet billing automation for **Tampa Bay OT LLC** — a home health billing agency that processes handwritten timesheets for 15+ healthcare agencies with 30+ clinicians.

## What It Does

1. **Timesheet intake** — Upload photos of handwritten timesheets (or receive via Gmail)
2. **AI OCR** — Claude Vision extracts patient name, clinician, dates, times, visit codes
3. **Auto-matching** — Fuzzy-matches clinicians, patients, and agencies to existing records
4. **Invoice generation** — Groups visits by agency, applies per-code billing rates, generates PDF invoices with timesheet images appended
5. **Payroll tracking** — Calculates clinician hours and pay
6. **Payment tracking** — Mark invoices sent/paid, track outstanding balances

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20 + Express |
| Frontend | React 18 + Tailwind CSS (Vite build, served as static) |
| Database | MongoDB 7 (Docker, internal network only — never exposed) |
| OCR | Anthropic Claude Vision API (Opus for OCR, Sonnet for classification) |
| PDF | Puppeteer (HTML→PDF) + pdf-lib (append timesheet images) |
| Email | Gmail API (optional — stubbed until credentials provided) |
| Container | Docker + docker-compose |

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env
# → Set ANTHROPIC_API_KEY (required for OCR)

# 2. Build and start
docker-compose up -d --build

# 3. Open dashboard
open http://localhost:3001
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key for OCR processing |
| `MONGO_URI` | No | MongoDB connection (default: `mongodb://mongo:27017/billing`) |
| `PORT` | No | Server port (default: `3001`) |
| `GMAIL_USER_EMAIL` | No | Gmail address for email polling |
| `GMAIL_CREDENTIALS_PATH` | No | Path to Google service account JSON |

## Project Structure

```
billing-automation/
├── Dockerfile                    # Node 20 + Chromium for Puppeteer
├── docker-compose.yml            # App + MongoDB containers
├── .env.example                  # Environment template
├── app/
│   ├── index.js                  # Express server entry point
│   ├── models/
│   │   ├── agency.js             # Healthcare agencies (name, rates, contacts)
│   │   ├── clinician.js          # Clinicians (name, title, pay rate, agencies)
│   │   ├── patient.js            # Patients (name, record #, agency)
│   │   ├── timesheet.js          # Timesheet records (OCR data, images, status)
│   │   ├── invoice.js            # Generated invoices (line items, PDF, status)
│   │   ├── billing-period.js     # Biweekly billing cycles
│   │   ├── billing-code.js       # Visit type codes (P, EVAL, RE-EVAL, etc.)
│   │   └── settings.js           # Key-value system settings
│   ├── routes/
│   │   ├── timesheets.js         # Upload, list, edit, reprocess, delete
│   │   ├── invoices.js           # Generate, list, mark sent/paid, PDF download
│   │   ├── payroll.js            # Payroll summaries
│   │   └── settings.js           # Agencies, clinicians, patients, billing config
│   ├── services/
│   │   ├── ocr.js                # Claude Vision OCR + document classification
│   │   ├── billing.js            # Invoice generation, rate resolution, previews
│   │   ├── pdf.js                # Puppeteer PDF rendering + image appending
│   │   └── gmail.js              # Gmail API integration (stub mode available)
│   ├── scripts/
│   │   └── fix-duplicate-records.js  # One-time cleanup for duplicate patient records
│   └── frontend/
│       ├── src/
│       │   ├── App.jsx           # Router — Overview, Timesheets, Invoices, Payroll, Settings
│       │   ├── pages/
│       │   │   ├── Overview.jsx  # Dashboard with stats, summaries, timecards
│       │   │   ├── Timesheets.jsx # Upload, view, edit, re-OCR timesheets
│       │   │   ├── Invoices.jsx  # Generate, view, mark sent/paid
│       │   │   ├── Payroll.jsx   # Clinician hours and pay breakdown
│       │   │   └── Settings.jsx  # Agencies, patients, clinicians, billing codes, periods
│       │   └── components/
│       │       └── PeriodSelector.jsx  # Date range / billing period picker
│       └── dist/                 # Built frontend (served by Express)
└── docs/
    └── USER_GUIDE.md             # End-user guide for Sandra / billing staff
```

## Data Architecture

```
MongoDB (internal Docker network only)
├── timesheets       — OCR data, image paths, visit details, status workflow
├── agencies         — Healthcare agencies + per-code billing rate cards
├── clinicians       — Clinician profiles, titles, pay rates, agency assignments
├── patients         — Patient records with clinical record numbers (unique)
├── billing_codes    — Master list: P, EVAL, RE-EVAL, DC, HT, WC, SV, etc.
├── billing_periods  — Biweekly cycles with auto-generation support
├── invoices         — Generated invoices with line items, PDF paths, payment status
└── settings         — System config (biller name, default rates, cycle settings)
```

## Billing Codes

| Code | Description | Default Rate |
|------|------------|-------------|
| P | Patient Visit (PT, OT, SN) | $85 |
| X | Psych RN Visit | $95 |
| EVAL | Evaluation | $150 |
| RE-EVAL | Re-evaluation | $120 |
| HT | High Tech Infusion | $120 |
| WC | Wound Care | $110 |
| S/U | Sign Up Visit | $75 |
| SV | Supervisory Visit | $60 |
| Hmk | Homemaker | $45 |

Rates are configurable per agency via rate cards in Settings → Agencies.

## API Reference

### Timesheets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/timesheets` | List (filterable by status, agency, date range) |
| GET | `/api/timesheets/revenue` | **Projected revenue from timecards** (before invoicing), filterable by date range |
| GET | `/api/timesheets/:id` | Get single timesheet with populated refs |
| POST | `/api/timesheets/upload` | Upload image → auto OCR |
| POST | `/api/timesheets/backfill` | Bulk insert structured historical data |
| PUT | `/api/timesheets/:id` | Manual correction |
| POST | `/api/timesheets/:id/reprocess` | Re-run OCR |
| GET | `/api/timesheets/:id/image` | Serve timesheet image |
| DELETE | `/api/timesheets/:id` | Delete timesheet + image |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List invoices (filterable) |
| POST | `/api/invoices/generate` | Generate invoices for a billing period |
| GET | `/api/invoices/preview` | Live invoice preview for current period |
| GET | `/api/invoices/:id/pdf` | Download invoice PDF |
| PATCH | `/api/invoices/:id/mark-sent` | Mark as sent |
| PATCH | `/api/invoices/:id/mark-paid` | Record payment |
| GET | `/api/invoices/stats/summary` | Revenue/payment statistics |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/settings` | General settings |
| GET/POST/PUT/DELETE | `/api/settings/agencies` | Agency CRUD |
| GET/POST/PUT/DELETE | `/api/settings/clinicians` | Clinician CRUD |
| GET/POST/PUT/DELETE | `/api/settings/patients` | Patient CRUD |
| GET/POST/PUT/DELETE | `/api/settings/billing-codes` | Billing code CRUD |
| GET/POST/PUT/DELETE | `/api/settings/billing-periods` | Billing period CRUD |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check + Gmail status |
| GET | `/api/payroll` | Payroll summary (filterable by date) |
| GET | `/api/settings/gmail/status` | Gmail connection status |

## OCR Pipeline

1. **Upload** — Image saved to `/app/data/images/`, SHA-256 hash checked for duplicates
2. **Classification** — Claude Sonnet classifies as `timesheet` or `discharge` document
3. **Extraction** — Claude Opus extracts all fields from handwritten timesheet:
   - Agency name, year
   - Employee name and title (PTA, RN, OT, etc.)
   - Patient name (Last, First format preserved)
   - Clinical record number
   - Visit rows: day, date, time in/out, duration, visit code
   - Confidence score (0.0 - 1.0)
4. **Auto-matching** — Fuzzy match (Levenshtein, 70% threshold) against existing:
   - Agencies → create if new
   - Clinicians → create if new
   - Patients → create if new, update record # if missing
5. **Flagging** — Confidence < 80% → flagged for human review
6. **Discharge docs** — Attached to most recent timesheet (within 5 min window)

## Revenue Before Invoicing (Timecard-Based)

The dashboard's **Projected Revenue** is calculated directly from timecards, so you can see expected revenue **before generating invoices**.

- Source: `processed`, `reviewed`, and `invoiced` timesheets
- Calculation: visit count × resolved billing rate
- Rate resolution priority:
  1. Agency rate card for visit code (e.g. EVAL, RE-EVAL, DC, P)
  2. Agency default rate
  3. System default rate
- Endpoint: `GET /api/timesheets/revenue?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- Overview uses this endpoint for projected revenue, visits, agency count, and profit margin

## Invoice Generation

1. Select billing period → click Generate
2. System groups all processed/reviewed timesheets by agency
3. For each agency:
   - Resolves billing rate per visit code (agency rate card → agency default → system default)
   - Builds line items sorted by patient name then date
   - Generates PDF: invoice summary page + appended timesheet images (portrait)
   - Uses biller name: **Tampa Bay OT LLC**
   - Uses payment terms default: **Due on Receipt** (unless agency terms override)
   - Creates Gmail draft (if configured) with invoice PDF attached
4. Timesheets marked as `invoiced`, period marked as `closed`

## Maintenance

### Retention & Backup Policy
See: `docs/RETENTION_BACKUP_PLAN.md`

Policy summary:
- Daily backups (DB + files)
- Billing-cycle snapshots at each cycle close
- 7-year retention history

### Backup MongoDB
```bash
docker exec billing-automation-mongo mongodump --out /data/backup
docker cp billing-automation-mongo:/data/backup ./backup-$(date +%Y%m%d)
```

### Fix Duplicate Patient Records
```bash
docker exec billing-automation-app node scripts/fix-duplicate-records.js
```

### Rebuild Frontend
```bash
cd app/frontend && npm run build
# Then rebuild container
docker-compose down && docker-compose up -d --build --force-recreate
```

### View Logs
```bash
docker logs -f billing-automation-app
```

## HIPAA Considerations

- MongoDB never exposed to host network (internal Docker network only)
- All PHI stored in Docker volumes (encrypted at rest if host supports it)
- Human review required before invoices are sent (draft-only mode)
- No auto-sending emails — Gmail creates drafts only
- Patient clinical record numbers have unique constraint (no accidental dupes)
- Audit trail via MongoDB timestamps on all documents
- Discharge documents tracked and linked to patient records

## Costs

| Item | Monthly Cost |
|------|-------------|
| Claude Vision API | ~$2-5 (depends on volume) |
| Hosting | $0 (runs on existing Hetzner VPS) |
| Gmail API | $0 (free with Google Workspace) |
| MongoDB | $0 (self-hosted) |
| **Total** | **~$2-5/month** |

## Built By

**Tech Adventures** — Wesley Chapel, FL  
[fltechadventures.com](https://fltechadventures.com)
