/**
 * Billing Cycle Cron Job
 * Runs daily at 9 AM to check if billing period has closed and invoices need to be generated
 */

const cron = require('node-cron');
const BillingPeriod = require('../models/billing-period');
const Settings = require('../models/settings');
const { generateInvoicesForPeriod } = require('../services/billing');

async function checkBillingCycle() {
  try {
    const autoGenerate = await Settings.get('auto_generate_invoices', false);
    if (!autoGenerate) return; // Only auto-generate if explicitly enabled

    const now = new Date();

    // Find any closed-but-not-invoiced periods
    const closedPeriods = await BillingPeriod.find({
      status: 'open',
      endDate: { $lt: now },
      invoicesGenerated: false
    });

    for (const period of closedPeriods) {
      console.log(`[BillingCycle] Period ${period.label} has closed — generating invoices`);
      try {
        const result = await generateInvoicesForPeriod(period._id);
        console.log(`[BillingCycle] Generated ${result.created} invoices for period ${period.label}`);
      } catch (err) {
        console.error(`[BillingCycle] Error generating invoices for ${period.label}:`, err.message);
      }
    }

    // Also check for overdue invoices and update status
    const { default: Invoice } = require('../models/invoice');
    await Invoice.updateMany(
      { status: 'sent', dueDate: { $lt: now } },
      { status: 'overdue' }
    );
  } catch (err) {
    console.error('[BillingCycle] Cycle check error:', err.message);
  }
}

function start() {
  // Run at 9 AM every day
  cron.schedule('0 9 * * *', checkBillingCycle);
  console.log('[BillingCycle] Started — checks daily at 9:00 AM');
}

module.exports = { start, checkBillingCycle };
