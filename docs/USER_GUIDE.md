# Tampa Bay OT LLC — Billing System User Guide

Welcome to your billing automation system! This guide walks you through everything you need to do day-to-day.

---

## Getting Started

Open the billing dashboard in your browser:

**URL:** `http://[your-server-address]:3001`

You'll see five pages in the navigation:
- **Overview** — Dashboard with stats and summaries
- **Timesheets** — Upload and manage timesheet images
- **Invoices** — Generate and track invoices
- **Payroll** — View clinician hours and pay
- **Settings** — Manage agencies, patients, clinicians, billing codes

---

## Daily Workflow

### Step 1: Upload Timesheets

1. Go to **Timesheets**
2. Click **+ Upload**
3. Select a photo of the handwritten timesheet (JPG or PNG)
4. The system automatically reads the handwriting and extracts:
   - Agency name
   - Clinician name and title
   - Patient name
   - Visit dates, times, and codes
5. Wait a few seconds — the timesheet will appear in the list

**Tip:** You can also upload multiple timesheets at once using **Settings → Backfill** if you need to load a batch for a specific billing period.

### Step 2: Review Flagged Timesheets

If the system isn't confident about what it read (< 80% confidence), the timesheet is marked **Flagged** (yellow).

1. Filter by **Flagged** status using the dropdown
2. Click on a flagged timesheet to open it
3. You'll see the original image on the left and the extracted data on the right
4. Correct any errors in the fields
5. Click **Save & Mark Reviewed**

**What to check:**
- Is the patient name correct? (Should be "Last, First" format)
- Is the clinician name right?
- Are the visit dates and times accurate?
- Is the agency name matching the right agency?

### Step 3: Handle Discharge Documents

When you upload a discharge document (3-page clinical document), the system automatically:
- Detects it's a discharge (not a timesheet)
- Attaches it to the most recently uploaded timesheet (within 5 minutes)
- If no recent timesheet exists, it saves it separately for manual linking

You'll see a 📎 icon next to timesheets that have discharge documents attached.

---

## Generating Invoices

Invoices are generated per billing period, grouped by agency.

### Step 1: Make Sure Your Billing Period Exists

1. Go to **Settings → Billing Periods**
2. You should see the current period listed
3. If not, click **+ New Period** and enter the start date (end date auto-calculates for biweekly)

### Step 2: Generate

1. Go to **Invoices**
2. Select the billing period from the dropdown
3. Click **Generate**
4. The system will:
   - Group all processed timesheets by agency
   - Calculate amounts using each agency's rate card
   - Generate a PDF for each agency (invoice page + timesheet images)
   - Create Gmail drafts (if Gmail is connected)

### Step 3: Review and Send

1. Each invoice starts as **Draft**
2. Click **PDF** to download and review
3. When ready, click **Mark Sent**
4. When payment is received, click **Mark Paid** and enter the payment details

### What's in the Invoice PDF?

- **Page 1:** Professional invoice with:
  - Tampa Bay OT LLC header
  - Bill-to agency info
  - Line items: patient name, date, time in/out, duration, care type, rate, amount
  - Subtotal and total due
  - "Due on Receipt" payment terms
- **Remaining pages:** Original timesheet images (portrait orientation)

---

## Overview Dashboard

The Overview page gives you a snapshot of everything:

### Top Stats (Dark Section)
- **Timesheets** — Total processed for the selected period
- **Projected Revenue** — Sum of all visit amounts
- **Agencies** — Number of agencies with activity
- **Clinicians** — Number of active clinicians
- **Hours Worked / Payroll / Profit** — Financial summary

### Timesheet Summary by Agency & Employee
Shows each agency with their clinicians listed — how many timesheets, visits, and hours each person worked.

### Clinical Timecards (Short Periods Only)
When viewing a period of 31 days or less, you'll see every single visit listed out by agency, sorted by patient name A-Z. This is your detailed view for reviewing everything before generating invoices.

### Invoice Preview
Live preview of what invoices will look like before you generate them.

### Period Selector
Use the dropdown at the top right to switch between:
- Current billing period
- Custom date range
- All Time

---

## Settings

### Agencies
Each agency has:
- **Name and contact info**
- **Default billing rate** ($/hr fallback)
- **Rate card** — Custom rate per billing code (e.g., EVAL = $150, P = $85)

To set up rate cards:
1. Click **Edit** on an agency
2. Scroll to the Rate Card section
3. Enter rates for each billing code
4. Rates left at $0 will use the agency's default rate

### Patients
- Patients are auto-created when new names appear in timesheets
- Each patient can have a **Clinical Record #** (must be unique)
- You can edit patient details, assign them to agencies, and add notes

### Clinicians
- Also auto-created from timesheets
- Set their **title** (PTA, RN, OT, etc.), **pay rate**, and **agency assignments**

### Billing Codes
Master list of visit types:
| Code | Meaning |
|------|---------|
| P | Patient Visit |
| EVAL | Evaluation |
| RE-EVAL | Re-evaluation |
| DC | Discharge |
| X | Psych RN Visit |
| HT | High Tech Infusion |
| WC | Wound Care |
| S/U | Sign Up Visit |
| SV | Supervisory Visit |
| Hmk | Homemaker |

You can add custom codes if needed.

### Billing Periods
- **Cycle Settings** — Set the start day (e.g., Sunday), cycle length (biweekly), and anchor date
- Periods can auto-generate when the current one closes
- You can also create periods manually

---

## Payroll

The Payroll page shows:
- Each clinician's hours worked for the selected period
- Pay rate × hours = total pay
- Totals across all clinicians

Use the date range selector to view specific periods.

---

## Tips & Tricks

1. **Duplicate detection** — If you accidentally upload the same image twice, the system will catch it and warn you.

2. **Re-OCR** — If a timesheet was read poorly, open it and click **Re-OCR** to try again.

3. **Backfill** — Need to load historical timesheets? Use **Settings → Backfill** to upload a batch and assign them to a specific billing period.

4. **Sorting** — Timesheets are sorted by clinician name (A-Z), then by date. Invoice line items are sorted by patient name (A-Z), then by date.

5. **Clinical Record #** — Each patient should have a unique record number. If you see duplicates or wrong numbers, edit them in **Settings → Patients**.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Timesheet stuck on "pending" | Click into it and hit **Re-OCR** |
| Wrong patient/clinician name | Click the timesheet → edit the fields → Save |
| Generate button not working | Make sure you selected a billing period first |
| Duplicate record number error | Go to Settings → Patients and fix the duplicate |
| Images look sideways in PDF | This has been fixed — regenerate the invoice |
| Gmail not connected | System works fine without Gmail — upload timesheets manually |

---

## Need Help?

Contact **Tech Adventures**:
- 🌐 [fltechadventures.com](https://fltechadventures.com)
- 📞 (813) 364-8563
