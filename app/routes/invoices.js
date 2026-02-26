const express = require('express');
const router = express.Router();
const fs = require('fs');
const Invoice = require('../models/invoice');
const BillingPeriod = require('../models/billing-period');
const { generateInvoicesForPeriod } = require('../services/billing');

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

// GET /api/invoices — list invoices
router.get('/', async (req, res) => {
  try {
    const { status, agencyId, billingPeriodId, page = 1, limit = 50, startDate, endDate } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (agencyId) filter.agencyId = agencyId;
    if (billingPeriodId) filter.billingPeriodId = billingPeriodId;
    if (!billingPeriodId) {
      const pIds = await periodIdsInRange(startDate, endDate);
      if (pIds) filter.billingPeriodId = { $in: pIds };
    }

    const total = await Invoice.countDocuments(filter);
    const docs = await Invoice.find(filter)
      .populate('agencyId', 'name contactEmail')
      .populate('billingPeriodId', 'label startDate endDate')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ total, page: Number(page), limit: Number(limit), data: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/preview — live invoice previews for a period or date range
router.get('/preview', async (req, res) => {
  try {
    const { billingPeriodId, startDate, endDate } = req.query;
    const { getCurrentPeriod, getAllInvoicePreviews } = require('../services/billing');
    
    let periodIds = [];
    if (billingPeriodId) {
      periodIds = [billingPeriodId];
    } else if (startDate || endDate) {
      const pIds = await periodIdsInRange(startDate, endDate);
      periodIds = pIds || [];
    }
    if (!periodIds.length) {
      const period = await getCurrentPeriod();
      periodIds = [period._id];
    }

    // Fetch previews for all matching periods and merge
    let allPreviews = [];
    for (const pid of periodIds) {
      const previews = await getAllInvoicePreviews(pid);
      allPreviews = allPreviews.concat(previews || []);
    }
    res.json({ previews: allPreviews, periodIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/preview/:agencyId — single agency preview
router.get('/preview/:agencyId', async (req, res) => {
  try {
    const { billingPeriodId } = req.query;
    const { getCurrentPeriod, getInvoicePreview } = require('../services/billing');
    
    let periodId = billingPeriodId;
    if (!periodId) {
      const period = await getCurrentPeriod();
      periodId = period._id;
    }

    const preview = await getInvoicePreview(req.params.agencyId, periodId);
    if (!preview) return res.status(404).json({ error: 'No data for this agency/period' });
    res.json(preview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/stats/summary — invoice stats, optionally filtered by date range
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateMatch = {};
    if (startDate || endDate) {
      // Find billing periods that overlap with the date range
      const periodFilter = {};
      if (startDate) periodFilter.endDate = { $gte: new Date(startDate) };
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        periodFilter.startDate = { $lte: end };
      }
      const periodIds = await BillingPeriod.find(periodFilter).distinct('_id');
      dateMatch = { billingPeriodId: { $in: periodIds } };
    }

    const [total, paid, sent, overdue, draft] = await Promise.all([
      Invoice.aggregate([
        { $match: dateMatch },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Invoice.aggregate([
        { $match: { ...dateMatch, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
      ]),
      Invoice.aggregate([
        { $match: { ...dateMatch, status: 'sent' } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
      ]),
      Invoice.aggregate([
        { $match: { ...dateMatch, status: 'overdue' } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
      ]),
      Invoice.countDocuments({ ...dateMatch, status: 'draft' })
    ]);

    res.json({
      totalRevenue: total[0]?.total || 0,
      paid: { amount: paid[0]?.total || 0, count: paid[0]?.count || 0 },
      outstanding: { amount: sent[0]?.total || 0, count: sent[0]?.count || 0 },
      overdue: { amount: overdue[0]?.total || 0, count: overdue[0]?.count || 0 },
      drafts: draft
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id — single invoice
router.get('/:id', async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id)
      .populate('agencyId')
      .populate('billingPeriodId')
      .populate('timesheetIds');
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id/pdf — download invoice PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!doc.pdfPath || !fs.existsSync(doc.pdfPath)) {
      return res.status(404).json({ error: 'PDF not generated yet' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.invoiceNumber}.pdf"`);
    res.sendFile(doc.pdfPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/generate — manually trigger invoice generation
router.post('/generate', async (req, res) => {
  try {
    const { billingPeriodId } = req.body;
    if (!billingPeriodId) return res.status(400).json({ error: 'billingPeriodId required' });

    const result = await generateInvoicesForPeriod(billingPeriodId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/invoices/:id/mark-paid — mark invoice as paid
router.patch('/:id/mark-paid', async (req, res) => {
  try {
    const { paidDate, paidAmount, paymentNotes } = req.body;
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    doc.status = 'paid';
    doc.paidAt = paidDate ? new Date(paidDate) : new Date();
    if (paidAmount !== undefined) doc.paidAmount = paidAmount;
    if (paymentNotes) doc.paymentNotes = paymentNotes;

    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/:id/send — send invoice to agency (DEMO: simulates send)
router.post('/:id/send', async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id).populate('agencyId').populate('billingPeriodId');
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'draft') return res.status(400).json({ error: `Invoice is already ${doc.status}` });

    // DEMO MODE: simulate send without actually emailing
    doc.status = 'sent';
    doc.sentAt = new Date();
    await doc.save();
    return res.json(doc);

    // --- Real send logic below (disabled for demo) ---

    const agency = doc.agencyId;
    if (!agency?.contactEmail) {
      return res.status(400).json({ error: 'Agency has no contact email configured' });
    }

    const gmail = require('../services/gmail');
    const { buildInvoiceHtml } = require('../services/billing');

    let result;
    if (doc.gmailDraftId) {
      result = await gmail.sendDraft(doc.gmailDraftId);
    } else {
      const period = doc.billingPeriodId;
      const emailHtml = `
<p>Dear ${agency.contactName || agency.name || 'Team'},</p>
<p>Please find attached the invoice for services rendered during the billing period <strong>${period?.label || ''}</strong>.</p>
<table style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:4px 12px;font-weight:bold">Invoice #:</td><td>${doc.invoiceNumber}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold">Period:</td><td>${period?.label || ''}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold">Total Due:</td><td><strong>$${(doc.total || 0).toFixed(2)}</strong></td></tr>
</table>
<p>Please remit payment at your earliest convenience.</p>
<p>Best regards,<br/>Tampa Bay OT LLC</p>`;

      result = await gmail.sendEmail({
        to: agency.contactEmail,
        subject: `Invoice ${doc.invoiceNumber} — ${agency.name} — ${period?.label || ''}`,
        bodyHtml: emailHtml,
        pdfPath: doc.pdfPath
      });
    }

    doc.status = 'sent';
    doc.sentAt = new Date();
    await doc.save();

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/invoices/:id/mark-sent — mark invoice as sent
router.patch('/:id/mark-sent', async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    doc.status = 'sent';
    doc.sentAt = new Date();
    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id — update invoice
router.put('/:id', async (req, res) => {
  try {
    const doc = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoices/:id — delete invoice
// Draft invoices: delete directly
// Sent/Paid/Overdue/Void: require explicit force=true
router.delete('/:id', async (req, res) => {
  try {
    const { force } = req.query;
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (doc.status !== 'draft' && force !== 'true') {
      return res.status(400).json({
        error: `Invoice is ${doc.status}. Deleting non-draft invoices requires explicit confirmation.`,
        requiresWarning: true
      });
    }

    const Timesheet = require('../models/timesheet');
    await Timesheet.updateMany(
      { _id: { $in: doc.timesheetIds || [] } },
      { $set: { invoiceId: null, status: 'processed' } }
    );

    if (doc.pdfPath && fs.existsSync(doc.pdfPath)) {
      try { fs.unlinkSync(doc.pdfPath); } catch {}
    }

    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ success: true, deletedId: req.params.id, previousStatus: doc.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
