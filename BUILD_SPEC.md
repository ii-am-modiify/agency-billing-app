# Billing Automation — Build Specification

## What This Is
A system that processes handwritten clinical timesheets (received as email photo attachments), OCRs them, categorizes by agency/patient, generates invoice PDFs, and creates Gmail drafts for review.

## Project Setup
- **Base template:** Copy from `../templates/client-project/`
- **Port:** 3001
- **Project name:** billing-automation
- **Container name prefix:** billing-automation
- **Docker network:** billing-automation_net (isolated)

## Architecture

### Backend (Node.js + Express)
Single Express server handling:
- REST API for dashboard
- Gmail polling (cron job — check inbox every 5 minutes)
- OCR processing queue
- PDF generation
- Gmail draft creation

### Frontend (React + Tailwind)
Simple dashboard SPA served by the Express backend:
- Timesheet inbox view (incoming, processed, flagged)
- Invoice list (per agency, per cycle, with paid/unpaid status)
- Payroll view (per clinician, hours, earnings)
- Stats/overview page
- Mark invoice as paid (single click)

### Database (MongoDB 7)
Collections:
- `timesheets` — individual parsed timesheets
- `agencies` — the 15 healthcare agencies
- `clinicians` — the 30 clinicians/employees
- `billing_periods` — biweekly cycles
- `invoices` — generated invoices with payment status
- `settings` — billing rates, cycle config

## OCR Pipeline

### Input
Photos of handwritten "Weekly Visit/Time Record" forms. Two known variants:
- "Advanced Home Healthcare" forms
- "Apollo Advanced Home Health Corp." forms

### Extraction (Claude Vision API)
For each image, extract:
```json
{
  "company": "string — healthcare agency name printed on form",
  "year": "string",
  "employee_name": "string — clinician who filled out the form",
  "employee_title": "string — PTA, RN, etc.",
  "patient_name": "string — Last, First format",
  "clinical_record_number": "string",
  "patient_address": "string — full address",
  "visits": [
    {
      "day": "string — Mon, Tue, etc.",
      "date": "string — M/DD format",
      "visit_code": "string or null",
      "nc_code": "string or null",
      "time_in": "string — H:MM",
      "time_out": "string — H:MM",
      "duration_minutes": "number — calculated",
      "units": "string or null"
    }
  ],
  "total_visits": "number",
  "total_units_or_hours": "string or null",
  "confidence": "number 0-1 — overall OCR confidence"
}
```

### Confidence & Flagging
- If overall confidence < 0.8, flag for human review
- If any critical field (agency, patient, date, time) has low confidence, flag
- Flagged timesheets appear in dashboard with the original image side-by-side for manual correction

### Duplicate & Out-of-Scope Detection
1. **Exact duplicate image** — SHA-256 hash every image on intake. If hash exists in DB, skip and flag as "Duplicate — identical image already processed"
2. **Same data, different image** — After OCR, check for existing record with same clinician + patient + date + time_in + time_out. If match found, flag as "Possible duplicate — matching visit already on file" and send to Needs Review
3. **Out of billing period** — After OCR extracts visit date, check if it falls within the current (or any open) billing period. If not, flag as "Out of scope — visit date [date] is outside current billing period [period]" and send to Needs Review
- All three cases → email moved to "Needs Review" folder in Gmail
- Dashboard shows the flag reason so Sandra can decide what to do

## PDF Invoice Generation

Each invoice PDF contains:
1. **Page 1: Invoice Summary**
   - Agency name + address (header)
   - "Tech Adventures" or client's company as biller (configurable)
   - Billing period dates
   - Table: Patient Name | Date | Time In | Time Out | Duration | Care Type | Rate | Amount
   - Subtotal, any adjustments, **Total Due**
   - Payment terms
2. **Remaining pages: Original timesheet images**
   - Appended in the same order as the line items on page 1
   - One image per page (or fit multiple if small)

Use **Puppeteer** or **pdf-lib** for generation. HTML template → PDF for page 1, then append images.

## Google Drive — Timesheet Archive

After OCR processing, automatically organize and archive original timesheet images:

### Folder Structure
```
Timesheets/
└── {Agency Name}/
    └── MM-DD-YYYY_MM-DD-YYYY/
        ├── {LastName}_{FirstName}_{MM-DD-YYYY}.jpeg
        └── ...
```

Example:
```
Timesheets/
└── Advanced Home Healthcare/
    └── 02-10-2026_02-24-2026/
        ├── Martin_William_02-13-2026.jpeg
        └── Charon_Rosa_02-10-2026.jpeg
```

### File Renaming
Original filenames (e.g., `IMG_7812.jpeg`) renamed to: `LastName_FirstName_MM-DD-YYYY.jpeg`
- Data comes from OCR extraction (patient name + visit date)
- If multiple visits on same date, append sequence: `LastName_FirstName_MM-DD-YYYY_2.jpeg`
- Preserve original file extension

### Implementation
- Use Google Drive API (same service account as Gmail)
- Create agency folders if they don't exist
- Create billing period subfolders per cycle
- Upload renamed images after successful OCR processing
- Store Drive file IDs in MongoDB for reference

---

## Gmail Integration

### Inbox Monitoring
- Poll inbox every 5 minutes via Gmail API
- Look for emails with image attachments (jpg, jpeg, png)
- Download attachments, store in `/app/data/images/`
- Extract email metadata: sender, subject, date, body text
- Queue each attachment for OCR processing

### Email Organization (Gmail Folders)
Three folders managed by the system (Sandra creates these manually or system auto-creates):
1. **New Emails** — where incoming timesheet emails arrive. System polls this folder.
2. **Needs Review** — emails with issues (low OCR confidence, duplicates, out of scope, unreadable)
3. **Processed** — successfully OCR'd and added to billing pipeline

Flow:
- System polls "New Emails" folder every 5 minutes
- On success → move email to "Processed"
- On problem → move email to "Needs Review"
- Original email stays intact (just moved, not deleted)
- Dashboard shows which emails are in "Needs Review" with a link to open in Gmail

### Draft Creation
- After billing period closes and invoices are generated
- Create one Gmail draft per agency
- Subject: "Invoice — [Agency Name] — [Period Dates]"
- Body: Professional invoice email template
- Attachment: The generated invoice PDF
- Drafts land in Gmail for review — client opens, reviews, hits send

### Auth
- Use Google Service Account with domain-wide delegation
- OR OAuth2 refresh token flow
- Store credentials in `/app/data/credentials/` (Docker volume, not in code)

## Dashboard Pages

### 1. Overview / Stats
- Timesheets received this cycle: X/estimated
- Invoices generated: X/15
- Revenue this cycle: $X
- Outstanding: $X (unpaid invoices)
- Overdue: $X (30+ days)
- Payroll this cycle: $X
- Profit: Revenue - Payroll

### 2. Timesheets
- Table: Date Received | Clinician | Agency | Patient | Status (processed/flagged/reviewed)
- Click to view original image + parsed data side-by-side
- Edit parsed data if OCR was wrong
- Filter by: agency, clinician, date range, status

### 2b. Needs Review Queue
- Shows all flagged timesheets with the flag reason (low confidence, duplicate, out of scope, unreadable)
- Split view: original image on left, editable extracted fields on right
- Actions per item:
  - **Approve** — correct any fields, click approve → moves to billing pipeline, email moved to Completed in Gmail
  - **Dismiss as Duplicate** — confirm duplicate → archived, not billed
  - **Reassign Period** — pick a different billing period → added to that period
  - **Reject** — not a valid timesheet → archived with a note, email stays in Needs Review
- Count badge on nav: "Needs Review (7)" so Sandra sees at a glance

### 3. Invoices
- Table: Agency | Period | Amount | Status (draft/sent/paid/overdue) | Date Sent | Date Paid
- Click to view/download PDF
- "Mark Paid" button with date picker
- Filter by: status, agency, period

### 4. Payroll
- Table: Clinician | Title | Hours This Cycle | Pay Rate | Earnings
- Totals at bottom
- Export to CSV

### 5. Settings
- Agency list (add/edit/remove)
- Clinician list (add/edit/remove, assign to agencies)
- Billing rates per care type
- Pay rates per clinician
- Billing cycle config (start date, biweekly)
- Gmail connection settings

## Sample Data
Three sample timesheets are in `timesheets/` directory:
- `IMG_7812.jpeg` — Advanced Home Healthcare, patient William Martin
- `IMG_7813.jpeg` — Advanced Home Healthcare, patient Rosa Charon
- `time-sheet-1.jpeg` — Apollo Advanced Home Health Corp., patient Thomas Lech

Use these for testing the OCR pipeline. The system should successfully parse all three.

## Environment Variables (.env)
```
PROJECT_NAME=billing-automation
APP_PORT=3001
DB_USER=billing
DB_PASSWORD=<generate secure password>
DB_NAME=billing_automation
ANTHROPIC_API_KEY=<from secrets>
GMAIL_CREDENTIALS_PATH=/app/data/credentials/gmail.json
GMAIL_USER_EMAIL=<client email — TBD>
NODE_ENV=production
```

## Key Constraints
- Database NEVER exposed to host — internal Docker network only
- All images stored in Docker volume (not host filesystem)
- HIPAA considerations: encrypted at rest, no logging of PHI to stdout, audit trail
- Human-in-the-loop: ALL invoice drafts require manual review before sending
- No auto-sending emails ever — drafts only

## File Structure
```
billing-automation/
├── docker-compose.yml
├── Dockerfile
├── .env
├── app/
│   ├── index.js              — Express server entry point
│   ├── package.json
│   ├── routes/
│   │   ├── api.js            — REST API routes
│   │   ├── timesheets.js     — timesheet CRUD
│   │   ├── invoices.js       — invoice management
│   │   ├── payroll.js        — payroll views
│   │   └── settings.js       — config management
│   ├── services/
│   │   ├── gmail.js          — Gmail API integration
│   │   ├── ocr.js            — Claude Vision OCR
│   │   ├── pdf.js            — Invoice PDF generation
│   │   ├── billing.js        — Billing period logic
│   │   └── db.js             — MongoDB connection
│   ├── models/
│   │   ├── timesheet.js
│   │   ├── agency.js
│   │   ├── clinician.js
│   │   ├── invoice.js
│   │   └── billing-period.js
│   ├── cron/
│   │   ├── email-poller.js   — Check inbox every 5 min
│   │   └── billing-cycle.js  — Biweekly invoice generation
│   ├── templates/
│   │   ├── invoice.html      — Invoice PDF template
│   │   └── email.html        — Draft email body template
│   └── frontend/             — React app (built, served static)
│       ├── src/
│       │   ├── App.jsx
│       │   ├── pages/
│       │   │   ├── Overview.jsx
│       │   │   ├── Timesheets.jsx
│       │   │   ├── Invoices.jsx
│       │   │   ├── Payroll.jsx
│       │   │   └── Settings.jsx
│       │   └── components/
│       └── dist/             — Built frontend served by Express
├── timesheets/               — Sample images for testing
└── BUILD_SPEC.md             — This file
```
