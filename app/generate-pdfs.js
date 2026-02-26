#!/usr/bin/env node
/**
 * Batch PDF generation — pure PDFKit, no browser needed.
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Invoice = require('./models/invoice');
const Agency = require('./models/agency');
const BillingPeriod = require('./models/billing-period');
const Settings = require('./models/settings');
const { renderInvoicePdf } = require('./services/pdf');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://billing:demodemo@localhost:27017/billing_demo?authSource=billing_demo';
const INVOICES_DIR = '/app/data/invoices';
const CONCURRENCY = 20; // pure code — can go much higher than Puppeteer

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);

  const billerSetting = await Settings.findOne({ key: 'biller_name' });
  const billerName = billerSetting?.value || 'Tech Adventures Agency Billing System Demo';

  if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });

  const invoices = await Invoice.find({ $or: [{ pdfPath: { $exists: false } }, { pdfPath: null }, { pdfPath: '' }] })
    .populate('agencyId')
    .populate('billingPeriodId');

  console.log(`${invoices.length} invoices need PDFs`);
  if (invoices.length === 0) { await mongoose.disconnect(); return; }

  let count = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < invoices.length; i += CONCURRENCY) {
    const batch = invoices.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (inv) => {
      try {
        const pdfBytes = await renderInvoicePdf(inv, inv.agencyId, inv.billingPeriodId, billerName);

        const filename = `${inv.invoiceNumber}.pdf`;
        const outputPath = path.join(INVOICES_DIR, filename);
        fs.writeFileSync(outputPath, pdfBytes);

        inv.pdfPath = outputPath;
        await inv.save();
        count++;
      } catch (err) {
        errors++;
        if (errors <= 5) console.error(`  ❌ ${inv.invoiceNumber}: ${err.message}`);
      }
    }));

    if (count % 100 === 0 || count === invoices.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (count / elapsed * 60).toFixed(0);
      console.log(`  ${count}/${invoices.length} (${elapsed}s, ~${rate}/min)`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Generated ${count} PDFs in ${totalTime}s (${errors} errors)`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
