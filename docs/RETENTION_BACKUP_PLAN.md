# Billing Automation — Data Retention, Backups, and Snapshots Plan

**Client:** Tampa Bay OT LLC  
**System:** Billing Automation  
**Retention Target:** **7 years**

---

## 1) Retention Policy (7 Years)

### Records to keep
- Timesheet images (JPG/PNG)
- Generated invoice PDFs
- OCR/visit metadata in database
- Billing period summaries/snapshots
- Patient, agency, clinician master records

### Retention windows
- **Hot storage (fast access):** 24 months
- **Archive storage (cheap, long-term):** months 25–84 (up to 7 years)
- **Deletion:** after 84 months (unless legal hold)

### Notes
- Metadata must remain queryable for reporting/audit during full 7-year window.
- Archived files should remain restorable within 24 hours.

---

## 2) Backup Schedule

## Daily Backups (required)
Run every day (recommended: **02:00 America/New_York**):

1. **MongoDB dump**
   - Full logical backup (`mongodump`)
   - Store in backup location with date stamp
2. **File backup**
   - `/app/data/images`
   - `/app/data/invoices`
   - `/app/data/bug-reports`
3. **Verification**
   - Hash/checksum generated
   - Backup manifest written

Keep **35 daily restore points** minimum.

---

## 3) Billing-Cycle Snapshots (required)

At each billing cycle close (biweekly when invoices are generated):

Create an immutable snapshot package:
- Billing period metadata (start/end/label)
- All invoice records for the period
- All referenced timesheet IDs
- All PDF invoices for the period
- All source timesheet images used in that period

Snapshot naming:
- `snapshot_<periodLabel>_<YYYYMMDD>.tar.zst`

Retention:
- Keep all billing-cycle snapshots for **7 years**
- Store in archive tier + replicated backup location

---

## 4) Storage Layout

Recommended structure:

- `backups/daily/db/YYYY/MM/DD/`
- `backups/daily/files/YYYY/MM/DD/`
- `backups/snapshots/billing-cycles/YYYY/`
- `backups/manifests/`

---

## 5) Recovery Objectives

- **RPO (data loss):** up to 24 hours max (daily backups)
- **RTO (restore time):**
  - Recent restore: < 2 hours
  - Archived snapshot restore: < 24 hours

---

## 6) Operational Checklist

### Daily
- [ ] Backup job ran successfully
- [ ] Manifest/checksum created
- [ ] Backup copied off-server

### Per billing cycle close
- [ ] Snapshot package created
- [ ] Snapshot uploaded to archive storage
- [ ] Snapshot restore test metadata verified

### Monthly
- [ ] Perform test restore (DB + sample files)
- [ ] Verify retention pruning works
- [ ] Verify archive accessibility

---

## 7) Security Requirements

- Backups encrypted at rest
- Backup transport encrypted in transit
- Access limited to authorized operators
- Audit log for backup/restore operations
- No public access to backup buckets/locations

---

## 8) Implementation Plan (v1.2 ops target)

1. Add automated daily backup cron job in infrastructure
2. Add billing-cycle snapshot job triggered at period close
3. Add retention pruning job (daily)
4. Add monthly restore test job + report
5. Document restore runbook in project docs

---

## 9) Runbook Commands (current Docker baseline)

### Manual DB backup
```bash
docker exec billing-automation-mongo mongodump --archive=/tmp/billing-$(date +%F).archive --gzip
docker cp billing-automation-mongo:/tmp/billing-$(date +%F).archive ./backups/
```

### Manual files backup
```bash
tar -czf backups/files-$(date +%F).tar.gz \
  projects/billing-automation/app/data/images \
  projects/billing-automation/app/data/invoices \
  projects/billing-automation/app/data/bug-reports
```

### Billing-cycle snapshot (manual baseline)
```bash
# export period data + copy related files to a snapshot folder, then archive
# (to be automated in v1.2)
```

---

## 10) Decision Summary

Approved plan:
- ✅ Daily backups
- ✅ Billing-cycle snapshots
- ✅ 7-year retention history
- ✅ Move older records to archive tier to control costs
