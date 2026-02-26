const express = require('express');
const router = express.Router();
const Timesheet = require('../models/timesheet');
const Clinician = require('../models/clinician');
const BillingPeriod = require('../models/billing-period');

// Helper: find billing period IDs that overlap a date range
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

// GET /api/payroll — payroll summary
// Accepts: ?billingPeriodId=, ?startDate=YYYY-MM-DD, ?endDate=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { billingPeriodId, startDate, endDate } = req.query;

    const tsFilter = { status: { $in: ['processed', 'reviewed', 'invoiced'] } };
    if (billingPeriodId) tsFilter.billingPeriodId = billingPeriodId;

    if (!billingPeriodId && (startDate || endDate)) {
      const pIds = await periodIdsInRange(startDate, endDate);
      if (pIds) tsFilter.billingPeriodId = { $in: pIds };
    }

    // Use aggregation pipeline instead of loading all timesheets into memory
    const pipeline = [
      { $match: tsFilter },
      { $project: {
        clinicianId: 1, agencyId: 1,
        data: { $ifNull: ['$manualData', '$ocrData'] }
      }},
      { $unwind: { path: '$data.visits', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: '$clinicianId',
        totalMinutes: { $sum: { $ifNull: ['$data.visits.durationMinutes', 0] } },
        totalVisits: { $sum: { $cond: [{ $ifNull: ['$data.visits', false] }, 1, 0] } },
        agencies: { $addToSet: '$agencyId' },
        timesheetIds: { $addToSet: '$_id' },
        employeeName: { $first: '$data.employeeName' },
        employeeTitle: { $first: '$data.employeeTitle' }
      }},
      { $lookup: {
        from: 'clinicians', localField: '_id', foreignField: '_id', as: 'clinician'
      }},
      { $unwind: { path: '$clinician', preserveNullAndEmptyArrays: true } },
      { $lookup: {
        from: 'agencies', localField: 'agencies', foreignField: '_id', as: 'agencyDocs'
      }},
      { $project: {
        clinicianId: '$_id',
        name: { $ifNull: ['$clinician.name', '$employeeName'] },
        title: { $ifNull: ['$clinician.title', '$employeeTitle'] },
        payRate: { $ifNull: ['$clinician.payRate', 0] },
        totalMinutes: 1, totalVisits: 1,
        timesheetCount: { $size: '$timesheetIds' },
        agencies: { $map: { input: '$agencyDocs', as: 'a', in: '$$a.name' } }
      }}
    ];

    const aggResults = await Timesheet.aggregate(pipeline);

    const rows = aggResults.map(e => {
      const hours = (e.totalMinutes || 0) / 60;
      return {
        clinicianId: e.clinicianId,
        name: e.name || 'Unknown',
        title: e.title || '',
        payRate: e.payRate || 0,
        totalHours: Math.round(hours * 100) / 100,
        totalVisits: e.totalVisits || 0,
        totalMinutes: e.totalMinutes || 0,
        earnings: Math.round(hours * (e.payRate || 0) * 100) / 100,
        agencies: e.agencies || [],
        timesheetCount: e.timesheetCount || 0
      };
    });

    const totalPayroll = rows.reduce((sum, r) => sum + r.earnings, 0);
    const totalHours = rows.reduce((sum, r) => sum + r.totalHours, 0);

    res.json({
      rows,
      totals: {
        payroll: Math.round(totalPayroll * 100) / 100,
        hours: Math.round(totalHours * 100) / 100,
        clinicians: rows.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payroll/clinicians — list clinicians
router.get('/clinicians', async (req, res) => {
  try {
    const docs = await Clinician.find({ active: true }).populate('agencies', 'name').sort({ name: 1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payroll/clinicians — create clinician
router.post('/clinicians', async (req, res) => {
  try {
    const doc = new Clinician(req.body);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payroll/clinicians/:id — update clinician
router.put('/clinicians/:id', async (req, res) => {
  try {
    const doc = await Clinician.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Payroll Payments ───

const PayrollPayment = require('../models/payroll-payment');

// GET /api/payroll/payments — list payments
router.get('/payments', async (req, res) => {
  try {
    const { status, billingPeriodId, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (billingPeriodId) filter.billingPeriodId = billingPeriodId;

    const total = await PayrollPayment.countDocuments(filter);
    const docs = await PayrollPayment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ total, data: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payroll/payments — create payment record(s) for a period
router.post('/payments', async (req, res) => {
  try {
    const { clinicianId, clinicianName, clinicianTitle, billingPeriodId, periodLabel, baseAmount, baseHours, baseVisits, payRate } = req.body;

    const doc = new PayrollPayment({
      clinicianId, clinicianName, clinicianTitle,
      billingPeriodId, periodLabel,
      baseAmount, baseHours, baseVisits, payRate
    });
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payroll/payments/generate — bulk create for all clinicians in a period
router.post('/payments/generate', async (req, res) => {
  try {
    const { billingPeriodId, startDate, endDate, periodLabel } = req.body;

    // Get payroll data
    const tsFilter = { status: { $in: ['processed', 'reviewed', 'invoiced'] } };
    if (billingPeriodId) tsFilter.billingPeriodId = billingPeriodId;
    if (!billingPeriodId && (startDate || endDate)) {
      const pIds = await periodIdsInRange(startDate, endDate);
      if (pIds) tsFilter.billingPeriodId = { $in: pIds };
    }

    const timesheets = await Timesheet.find(tsFilter)
      .populate('clinicianId', 'name title payRate');

    const byClinicianMap = {};
    for (const ts of timesheets) {
      const data = ts.manualData || ts.ocrData;
      if (!data) continue;
      const clinicianId = ts.clinicianId?._id?.toString() || `ocr_${data.employeeName}`;
      const clinicianName = ts.clinicianId?.name || data.employeeName || 'Unknown';
      const clinicianTitle = ts.clinicianId?.title || data.employeeTitle || '';
      const payRate = ts.clinicianId?.payRate || 0;

      if (!byClinicianMap[clinicianId]) {
        byClinicianMap[clinicianId] = {
          clinicianId: ts.clinicianId?._id || null,
          name: clinicianName, title: clinicianTitle, payRate,
          totalMinutes: 0, totalVisits: 0
        };
      }
      for (const visit of (data.visits || [])) {
        byClinicianMap[clinicianId].totalMinutes += visit.durationMinutes || 0;
        byClinicianMap[clinicianId].totalVisits++;
      }
    }

    const created = [];
    for (const [id, e] of Object.entries(byClinicianMap)) {
      // Skip if payment already exists for this clinician+period
      const existing = await PayrollPayment.findOne({
        clinicianName: e.name,
        ...(billingPeriodId ? { billingPeriodId } : {}),
        ...(periodLabel ? { periodLabel } : {})
      });
      if (existing) continue;

      const hours = e.totalMinutes / 60;
      const baseAmount = Math.round(hours * e.payRate * 100) / 100;

      const doc = new PayrollPayment({
        clinicianId: e.clinicianId,
        clinicianName: e.name,
        clinicianTitle: e.title,
        billingPeriodId: billingPeriodId || null,
        periodLabel: periodLabel || '',
        baseAmount, baseHours: Math.round(hours * 100) / 100,
        baseVisits: e.totalVisits, payRate: e.payRate
      });
      await doc.save();
      created.push(doc);
    }

    res.json({ created: created.length, payments: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/payroll/payments/:id — update payment (adjust, mark paid)
router.patch('/payments/:id', async (req, res) => {
  try {
    const doc = await PayrollPayment.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const { adjustment, status, paidDate, paymentMethod, notes } = req.body;

    if (adjustment) {
      doc.adjustments.push(adjustment);
    }
    if (status) doc.status = status;
    if (paidDate) doc.paidDate = new Date(paidDate);
    if (paymentMethod) doc.paymentMethod = paymentMethod;
    if (notes !== undefined) doc.notes = notes;

    await doc.save(); // triggers pre-save totalAmount calc
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/payroll/payments/:id — delete pending payment
router.delete('/payments/:id', async (req, res) => {
  try {
    const doc = await PayrollPayment.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status === 'paid') return res.status(400).json({ error: 'Cannot delete a paid record' });
    await PayrollPayment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
