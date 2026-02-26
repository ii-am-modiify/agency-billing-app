/**
 * Billing service — handles billing period logic and invoice generation
 */

const BillingPeriod = require('../models/billing-period');
const Timesheet = require('../models/timesheet');
const Invoice = require('../models/invoice');
const Agency = require('../models/agency');
const Settings = require('../models/settings');
const { generateInvoicePdf } = require('./pdf');
const gmail = require('./gmail');

/**
 * Get or create the current open billing period
 */
async function getCurrentPeriod() {
  let period = await BillingPeriod.findOne({ status: 'open' }).sort({ startDate: -1 });
  if (period) return period;

  // Create new period from settings or default to biweekly starting today
  const startDateSetting = await Settings.get('billing_cycle_start');
  const now = new Date();
  let startDate;

  if (startDateSetting) {
    startDate = new Date(startDateSetting);
    while (startDate <= now) {
      startDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    }
    startDate = new Date(startDate.getTime() - 14 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
    startDate.setHours(0, 0, 0, 0);
  }

  const endDate = new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000);
  endDate.setHours(23, 59, 59, 999);

  period = new BillingPeriod({ startDate, endDate });
  await period.save();
  return period;
}

/**
 * Resolve the billing rate for a visit.
 * Priority: agency.rates[visitCode] → agency.billingRate.default → systemDefault
 */
function resolveRate(agencyDoc, visitCode, systemDefault) {
  if (agencyDoc?.rates && visitCode) {
    // Mongoose Map — use .get(); plain object — use bracket notation
    const rateFromMap = agencyDoc.rates instanceof Map
      ? agencyDoc.rates.get(visitCode)
      : agencyDoc.rates[visitCode];
    if (rateFromMap !== undefined && rateFromMap !== null) return rateFromMap;
  }
  if (agencyDoc?.billingRate?.default) return agencyDoc.billingRate.default;
  return systemDefault || 75;
}

/**
 * Generate invoices for all agencies that have processed timesheets in a billing period
 */
async function generateInvoicesForPeriod(billingPeriodId) {
  const period = await BillingPeriod.findById(billingPeriodId);
  if (!period) throw new Error('Billing period not found');

  const billerName = await Settings.get('biller_name', 'Tampa Bay OT LLC');
  const defaultRate = await Settings.get('default_billing_rate', 75);

  // Get all processed timesheets for this period
  const timesheets = await Timesheet.find({
    billingPeriodId,
    status: { $in: ['processed', 'reviewed'] },
    invoiceId: null
  }).populate('agencyId');

  if (!timesheets.length) {
    return { created: 0, message: 'No processed timesheets found for this period' };
  }

  // Group by agency
  const byAgency = {};
  for (const ts of timesheets) {
    const agencyId = ts.agencyId?._id?.toString() || ts.agencyId?.toString();
    if (!agencyId) continue;
    if (!byAgency[agencyId]) byAgency[agencyId] = { agency: ts.agencyId, timesheets: [] };
    byAgency[agencyId].timesheets.push(ts);
  }

  const created = [];

  for (const [agencyId, { agency, timesheets: agencyTs }] of Object.entries(byAgency)) {
    const agencyDoc = typeof agency === 'object' && agency !== null
      ? agency
      : await Agency.findById(agencyId);

    // Build line items from OCR/manual visit data
    const lineItems = [];
    const imagePaths = [];

    for (const ts of agencyTs) {
      const data = ts.manualData || ts.ocrData;
      if (!data) continue;

      if (ts.imagePath) imagePaths.push(ts.imagePath);

      for (const visit of (data.visits || [])) {
        const visitCode = visit.visitCode || '';
        const careType = visitCode || '';
        const rateCode = careType || 'P';
        const rate = resolveRate(agencyDoc, rateCode, defaultRate);
        const durationMins = visit.durationMinutes || 0;

        lineItems.push({
          timesheetId: ts._id,
          patientName: data.patientName || 'Unknown',
          clinicianName: data.employeeName || '',
          clinicianTitle: data.employeeTitle || '',
          date: visit.date || '',
          timeIn: visit.timeIn || '',
          timeOut: visit.timeOut || '',
          durationMinutes: durationMins,
          careType: careType || data.employeeTitle || 'Visit',
          rate,
          amount: rate  // per-visit flat billing
        });
      }
    }

    const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const paymentTermsDays = agencyDoc?.paymentTerms || 0; // 0 = due on receipt
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);

    let invoice = new Invoice({
      agencyId,
      billingPeriodId,
      timesheetIds: agencyTs.map(t => t._id),
      lineItems,
      subtotal,
      adjustments: 0,
      total: subtotal,
      dueDate
    });
    await invoice.save();

    // Generate PDF
    try {
      const pdfPath = await generateInvoicePdf(invoice, agencyDoc, period, imagePaths, billerName);
      invoice.pdfPath = pdfPath;

      // Create Gmail draft (stub if not configured)
      const emailHtml = buildInvoiceEmailHtml(invoice, agencyDoc, period);
      if (agencyDoc?.contactEmail) {
        const draftId = await gmail.createInvoiceDraft({
          to: agencyDoc.contactEmail,
          subject: `Invoice — ${agencyDoc.name} — ${period.label}`,
          bodyHtml: emailHtml,
          pdfPath
        });
        invoice.gmailDraftId = draftId;
      }

      invoice.status = 'draft';
      await invoice.save();

      // Mark timesheets as invoiced
      await Timesheet.updateMany(
        { _id: { $in: agencyTs.map(t => t._id) } },
        { status: 'invoiced', invoiceId: invoice._id }
      );

      created.push(invoice);
    } catch (err) {
      console.error(`[Billing] PDF generation failed for agency ${agencyId}:`, err.message);
    }
  }

  // Update period status
  period.status = 'invoiced';
  period.invoicesGenerated = true;
  period.closedAt = new Date();
  await period.save();

  return { created: created.length, invoices: created };
}

function buildInvoiceEmailHtml(invoice, agency, period) {
  return `
<p>Dear ${agency?.contactName || agency?.name || 'Team'},</p>
<p>Please find attached the invoice for services rendered during the billing period <strong>${period?.label || ''}</strong>.</p>
<table style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:4px 12px;font-weight:bold">Invoice #:</td><td>${invoice.invoiceNumber}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold">Period:</td><td>${period?.label || ''}</td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold">Total Due:</td><td><strong>$${(invoice.total || 0).toFixed(2)}</strong></td></tr>
  <tr><td style="padding:4px 12px;font-weight:bold">Due Date:</td><td>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Net 30'}</td></tr>
</table>
<p>Please remit payment at your earliest convenience. If you have any questions, please don't hesitate to reach out.</p>
<p>Thank you for your business.</p>
<br/>
<p>Best regards,<br/>Tampa Bay OT LLC</p>
`;
}

/**
 * Get a live invoice preview for an agency in a billing period.
 * Doesn't create an invoice — just calculates what it would look like.
 */
async function getInvoicePreview(agencyId, billingPeriodId) {
  const period = await BillingPeriod.findById(billingPeriodId);
  const agencyDoc = await Agency.findById(agencyId);
  if (!period || !agencyDoc) return null;

  const defaultRate = await Settings.get('default_billing_rate', 75);

  const timesheets = await Timesheet.find({
    billingPeriodId,
    agencyId,
    status: { $in: ['processed', 'reviewed', 'invoiced'] }
  }).sort({ createdAt: 1 });

  const lineItems = [];
  for (const ts of timesheets) {
    const data = ts.manualData || ts.ocrData;
    if (!data) continue;
    for (const visit of (data.visits || [])) {
      const visitCode = visit.visitCode || '';
      // Use extracted visit code, or leave empty (don't guess)
      const careType = visitCode || '';
      const rateCode = careType || 'P'; // for rate lookup only, default to P
      const rate = resolveRate(agencyDoc, rateCode, defaultRate);
      const durationMins = visit.durationMinutes || 0;
      lineItems.push({
        timesheetId: ts._id,
        patientName: data.patientName || 'Unknown',
        clinicianName: data.employeeName || '',
        clinicianTitle: data.employeeTitle || '',
        date: visit.date || '',
        timeIn: visit.timeIn || '',
        timeOut: visit.timeOut || '',
        durationMinutes: durationMins,
        careType: careType || data.employeeTitle || 'Visit',
        rate,
        amount: rate  // per visit flat rate
      });
    }
  }

  // Sort by patient name (asc), then date (asc)
  lineItems.sort((a, b) => {
    const nameA = (a.patientName || '').toLowerCase();
    const nameB = (b.patientName || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    // Same patient — sort by date
    const dateA = a.date || '';
    const dateB = b.date || '';
    return dateA.localeCompare(dateB);
  });

  const total = lineItems.reduce((sum, li) => sum + li.amount, 0);

  return {
    agency: { _id: agencyDoc._id, name: agencyDoc.name },
    period: { _id: period._id, label: period.label, startDate: period.startDate, endDate: period.endDate },
    lineItems,
    totalVisits: lineItems.length,
    total,
    timesheetCount: timesheets.length,
    status: 'preview'
  };
}

/**
 * Get all live invoice previews for the current period
 */
async function getAllInvoicePreviews(billingPeriodId) {
  const timesheets = await Timesheet.find({
    billingPeriodId,
    status: { $in: ['processed', 'reviewed', 'invoiced'] },
    agencyId: { $ne: null }
  }).distinct('agencyId');

  const previews = [];
  for (const agencyId of timesheets) {
    const preview = await getInvoicePreview(agencyId, billingPeriodId);
    if (preview && preview.lineItems.length > 0) previews.push(preview);
  }
  return previews;
}

module.exports = { getCurrentPeriod, generateInvoicesForPeriod, getInvoicePreview, getAllInvoicePreviews };
