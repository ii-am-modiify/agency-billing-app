const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Timesheet = require('../models/timesheet');
const Agency = require('../models/agency');
const BillingPeriod = require('../models/billing-period');
const { processTimesheet, classifyDocument } = require('../services/ocr');
const { getCurrentPeriod } = require('../services/billing');
const Settings = require('../models/settings');

const IMAGES_DIR = '/app/data/images';

// GET /api/timesheets/filter-options — unique clinicians and care types (cached)
let filterOptionsCache = null;
let filterOptionsCacheTime = 0;

router.get('/filter-options', async (req, res) => {
  try {
    // Cache for 5 minutes
    if (filterOptionsCache && Date.now() - filterOptionsCacheTime < 300000) {
      return res.json(filterOptionsCache);
    }
    const [clinicians, careTypes] = await Promise.all([
      Timesheet.distinct('ocrData.employeeName'),
      Timesheet.distinct('ocrData.visits.visitCode')
    ]);
    filterOptionsCache = {
      clinicians: clinicians.filter(Boolean).sort(),
      careTypes: careTypes.filter(Boolean).sort()
    };
    filterOptionsCacheTime = Date.now();
    res.json(filterOptionsCache);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: find billing period IDs that overlap the given date range
async function periodIdsInRange(startDate, endDate) {
  if (!startDate && !endDate) return null;
  const pFilter = {};
  if (startDate) pFilter.endDate = { $gte: new Date(startDate) };
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    pFilter.startDate = { ...(pFilter.startDate || {}), $lte: end };
  }
  const periods = await BillingPeriod.find(pFilter).select('_id').lean();
  return periods.map(p => p._id);
}

// GET /api/timesheets — list timesheets
router.get('/', async (req, res) => {
  try {
    const { status, agencyId, page = 1, limit = 50, startDate, endDate, search, clinician, careType } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (agencyId) filter.agencyId = agencyId;
    const pIds = await periodIdsInRange(startDate, endDate);
    if (pIds) filter.billingPeriodId = { $in: pIds };

    // Text search across patient/clinician names
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { 'ocrData.patientName': regex },
        { 'ocrData.employeeName': regex },
        { 'manualData.patientName': regex },
        { 'manualData.employeeName': regex }
      ];
    }
    // Clinician filter
    if (clinician) {
      filter.$or = [
        { 'ocrData.employeeName': clinician },
        { 'manualData.employeeName': clinician }
      ];
    }
    // Care type filter
    if (careType) {
      filter.$or = filter.$or || [];
      filter['ocrData.visits.visitCode'] = careType;
    }

    const total = await Timesheet.countDocuments(filter);

    // Lightweight count-only mode for dashboard
    if (req.query.countOnly === 'true') {
      const statusCounts = {};
      const statuses = await Timesheet.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      for (const s of statuses) statusCounts[s._id] = s.count;
      return res.json({ total, statusCounts });
    }

    const docs = await Timesheet.find(filter)
      .populate('agencyId', 'name')
      .populate('clinicianId', 'name title')
      .populate('billingPeriodId', 'label startDate endDate')
      .sort({ 'ocrData.employeeName': 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ total, page: Number(page), limit: Number(limit), data: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timesheets/revenue — calculate projected revenue from processed timesheets
router.get('/revenue', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { status: { $in: ['processed', 'reviewed', 'invoiced'] } };
    const pIds = await periodIdsInRange(startDate, endDate);
    if (pIds) filter.billingPeriodId = { $in: pIds };

    const timesheets = await Timesheet.find(filter).populate('agencyId').lean();
    const defaultRate = await Settings.get('default_billing_rate', 75);

    let totalRevenue = 0;
    let totalVisits = 0;
    const byAgency = {};

    for (const ts of timesheets) {
      const data = ts.manualData || ts.ocrData || {};
      const agencyDoc = ts.agencyId;
      const agencyName = agencyDoc?.name || data.company || 'Unknown';
      if (!byAgency[agencyName]) byAgency[agencyName] = { visits: 0, revenue: 0 };

      for (const visit of (data.visits || [])) {
        const visitCode = visit.visitCode || '';
        const code = visitCode || 'P';
        // Resolve rate: agency rate card → agency default → system default
        let rate = defaultRate;
        if (agencyDoc?.rates) {
          const rateFromCard = agencyDoc.rates instanceof Map
            ? agencyDoc.rates.get(code) : agencyDoc.rates[code];
          if (rateFromCard) rate = rateFromCard;
          else if (agencyDoc.billingRate?.default) rate = agencyDoc.billingRate.default;
        } else if (agencyDoc?.billingRate?.default) {
          rate = agencyDoc.billingRate.default;
        }

        totalRevenue += rate;
        totalVisits += 1;
        byAgency[agencyName].visits += 1;
        byAgency[agencyName].revenue += rate;
      }
    }

    res.json({ totalRevenue, totalVisits, timesheetCount: timesheets.length, byAgency });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timesheets/:id — get single timesheet
router.get('/:id', async (req, res) => {
  try {
    const doc = await Timesheet.findById(req.params.id)
      .populate('agencyId')
      .populate('clinicianId')
      .populate('billingPeriodId');
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets/upload — upload a timesheet image
// Accepts optional form field: billingPeriodId (for backfill/specific period assignment)
router.post('/upload', async (req, res) => {
  try {
    if (!req.files?.timesheet) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.timesheet;
    const ext = path.extname(file.name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      return res.status(400).json({ error: 'Only JPG/PNG files supported' });
    }

    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

    // Dedupe: SHA-256 hash check
    const crypto = require('crypto');
    const fileHash = crypto.createHash('sha256').update(file.data).digest('hex');
    const existingHash = await Timesheet.findOne({ imageHash: fileHash });
    if (existingHash) {
      return res.status(409).json({ 
        error: 'Duplicate image — this timesheet has already been uploaded',
        existingId: existingHash._id,
        duplicate: true
      });
    }

    const filename = `upload_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destPath = path.join(IMAGES_DIR, filename);
    await file.mv(destPath);

    // Classify document: timesheet vs discharge
    const docType = await classifyDocument(destPath);
    console.log(`[Upload] Classified "${file.name}" as: ${docType}`);

    if (docType === 'discharge') {
      // Attach to the most recent timesheet (same upload batch / recent)
      // Look for a timesheet uploaded in the last 5 minutes without discharge docs matching this agency
      const recentTimesheet = await Timesheet.findOne({
        documentType: 'timesheet',
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      }).sort({ createdAt: -1 });

      if (recentTimesheet) {
        recentTimesheet.dischargeDocs.push({
          imagePath: destPath,
          imageHash: fileHash,
          originalFilename: file.name
        });
        await recentTimesheet.save();
        console.log(`[Upload] Attached discharge doc to timesheet ${recentTimesheet._id}`);
        return res.json({
          success: true,
          documentType: 'discharge',
          attachedTo: recentTimesheet._id,
          message: `Discharge document attached to timesheet (${recentTimesheet.ocrData?.patientName || 'pending OCR'})`
        });
      }

      // No recent timesheet to attach to — save as standalone for manual linking
      const ts = new Timesheet({
        sourceType: 'upload',
        originalFilename: file.name,
        imagePath: destPath,
        imageHash: fileHash,
        documentType: 'discharge',
        status: 'processed'
      });
      await ts.save();
      return res.json({
        success: true,
        documentType: 'discharge',
        timesheetId: ts._id,
        message: 'Discharge document saved — no recent timesheet to attach to. Link it manually in the dashboard.'
      });
    }

    // Normal timesheet flow
    // Use provided billingPeriodId or fall back to current open period
    let period;
    const { billingPeriodId } = req.body;
    if (billingPeriodId) {
      period = await BillingPeriod.findById(billingPeriodId);
    }
    if (!period) period = await getCurrentPeriod();

    const ts = new Timesheet({
      sourceType: 'upload',
      originalFilename: file.name,
      imagePath: destPath,
      imageHash: fileHash,
      documentType: 'timesheet',
      billingPeriodId: period._id,
      status: 'pending'
    });
    await ts.save();

    // Start OCR in background
    processTimesheet(Timesheet, ts._id.toString())
      .catch(err => console.error('[Upload] OCR error:', err.message));

    res.json({ success: true, timesheetId: ts._id, documentType: 'timesheet', message: 'Uploaded and queued for OCR' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets/backfill — insert pre-structured historical timesheet data
router.post('/backfill', async (req, res) => {
  try {
    const { billingPeriod, timesheets } = req.body;
    if (!Array.isArray(timesheets) || timesheets.length === 0) {
      return res.status(400).json({ error: 'timesheets array is required and must be non-empty' });
    }

    // Resolve billing period — find existing or create from "MM-DD-YYYY_MM-DD-YYYY" string
    let periodDoc = null;
    if (billingPeriod) {
      const parts = billingPeriod.split('_');
      if (parts.length === 2) {
        const startDate = new Date(parts[0]);
        const endDate = new Date(parts[1]);
        periodDoc = await BillingPeriod.findOne({
          startDate: { $gte: startDate, $lte: new Date(startDate.getTime() + 86400000) }
        });
        if (!periodDoc) {
          periodDoc = new BillingPeriod({ startDate, endDate });
          await periodDoc.save();
        }
      }
    }

    const createdIds = [];
    for (const tData of timesheets) {
      const ts = new Timesheet({
        sourceType: 'upload',
        billingPeriodId: periodDoc?._id || null,
        status: 'processed',
        ocrData: {
          company: tData.company || null,
          year: tData.year || String(new Date().getFullYear()),
          employeeName: tData.employeeName || null,
          employeeTitle: tData.employeeTitle || null,
          patientName: tData.patientName || null,
          visits: (tData.visits || []).map(v => ({
            day: v.day || null,
            date: v.date || null,
            timeIn: v.timeIn || null,
            timeOut: v.timeOut || null,
            durationMinutes: v.durationMinutes || null
          })),
          totalVisits: (tData.visits || []).length,
          confidence: 1.0
        }
      });
      await ts.save();
      createdIds.push(ts._id);
    }

    res.json({ success: true, created: createdIds.length, ids: createdIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/timesheets/:id — update timesheet (manual correction)
router.put('/:id', async (req, res) => {
  try {
    const doc = await Timesheet.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const { manualData, status, agencyId, clinicianId, flagReason } = req.body;
    if (manualData) doc.manualData = manualData;
    if (status) doc.status = status;
    if (agencyId) doc.agencyId = agencyId;
    if (clinicianId) doc.clinicianId = clinicianId;
    if (flagReason !== undefined) doc.flagReason = flagReason;

    if (status === 'reviewed') {
      doc.reviewedAt = new Date();
    }

    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets/:id/reprocess — rerun OCR
router.post('/:id/reprocess', async (req, res) => {
  try {
    const doc = await Timesheet.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!doc.imagePath || !fs.existsSync(doc.imagePath)) {
      return res.status(400).json({ error: 'Image file not found' });
    }

    doc.status = 'pending';
    doc.ocrError = null;
    await doc.save();

    processTimesheet(Timesheet, doc._id.toString())
      .catch(err => console.error('[Reprocess] OCR error:', err.message));

    res.json({ success: true, message: 'Reprocessing started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timesheets/:id/image — serve the timesheet image
router.get('/:id/image', async (req, res) => {
  try {
    const doc = await Timesheet.findById(req.params.id);
    if (!doc || !doc.imagePath) return res.status(404).json({ error: 'Image not found' });
    if (!fs.existsSync(doc.imagePath)) return res.status(404).json({ error: 'Image file missing' });

    const ext = path.extname(doc.imagePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.sendFile(doc.imagePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/timesheets/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Timesheet.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.imagePath && fs.existsSync(doc.imagePath)) {
      fs.unlinkSync(doc.imagePath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
