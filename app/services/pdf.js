const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDoc } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);

const INVOICES_DIR = '/app/data/invoices';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/**
 * Generate invoice PDF page using PDFKit (no browser needed)
 */
function renderInvoicePdf(invoice, agency, billingPeriod, billerName = 'Tampa Bay OT LLC') {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 54, right: 54, bottom: 54, left: 54 } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = 612 - 108; // usable width (letter minus margins)
    const blue = '#1a56db';
    const gray = '#666666';
    const darkGray = '#333333';
    const lightBg = '#f5f8ff';

    // ── Header ──
    doc.fontSize(22).fillColor(blue).font('Helvetica-Bold').text(billerName, 54, 54);
    doc.fontSize(10).fillColor(gray).font('Helvetica').text('Billing & Home Health Services', 54, 80);

    // Invoice meta (right side)
    doc.fontSize(20).fillColor(darkGray).font('Helvetica-Bold').text('INVOICE', 350, 54, { align: 'right', width: pageW - 296 });
    const badgeX = 504 - 12;
    const invNumW = doc.widthOfString(invoice.invoiceNumber, { fontSize: 10 });
    doc.roundedRect(612 - 54 - invNumW - 16, 80, invNumW + 16, 18, 3)
      .fillAndStroke('#e8f4fd', blue);
    doc.fontSize(10).fillColor(blue).font('Helvetica-Bold')
      .text(invoice.invoiceNumber, 612 - 54 - invNumW - 8, 84);
    doc.font('Helvetica').fillColor('#555555').fontSize(10);
    doc.text(`Period: ${billingPeriod?.label || ''}`, 350, 104, { align: 'right', width: pageW - 296 });
    const dueDate = invoice.dueDate && (new Date(invoice.dueDate) > new Date(Date.now() + 86400000))
      ? formatDate(invoice.dueDate) : 'Due on Receipt';
    doc.text(`Due: ${dueDate}`, 350, 118, { align: 'right', width: pageW - 296 });

    // ── Bill To / From ──
    let y = 150;
    doc.fontSize(8).fillColor('#888888').font('Helvetica-Bold').text('BILL TO', 54, y);
    doc.fontSize(8).text('FROM', 320, y);
    y += 16;
    doc.fontSize(11).fillColor('#222222').font('Helvetica-Bold').text(agency?.name || '', 54, y);
    doc.text(billerName, 320, y);
    y += 16;
    doc.font('Helvetica').fontSize(10).fillColor('#444444');
    if (agency?.contactEmail) doc.text(agency.contactEmail, 54, y);
    doc.text('Wesley Chapel, FL', 320, y);
    if (agency?.contactName) { y += 14; doc.text(`Attn: ${agency.contactName}`, 54, y); }

    // ── Table ──
    y += 30;
    const cols = [
      { label: 'Patient', x: 54, w: 130 },
      { label: 'Date', x: 184, w: 80 },
      { label: 'Clinician', x: 264, w: 140 },
      { label: 'Care Type', x: 404, w: 70 },
      { label: 'Amount', x: 474, w: 84 }
    ];

    // Header row
    doc.rect(54, y, pageW, 24).fill(blue);
    doc.fontSize(9).fillColor('white').font('Helvetica-Bold');
    cols.forEach(c => doc.text(c.label, c.x + 6, y + 7, { width: c.w - 12 }));
    y += 24;

    // Data rows
    const lineItems = invoice.lineItems || [];
    const rowH = 20;
    doc.font('Helvetica').fontSize(9).fillColor('#222222');

    for (let i = 0; i < lineItems.length; i++) {
      // Page break if needed
      if (y + rowH > 700) {
        doc.addPage();
        y = 54;
        // Reprint header
        doc.rect(54, y, pageW, 24).fill(blue);
        doc.fontSize(9).fillColor('white').font('Helvetica-Bold');
        cols.forEach(c => doc.text(c.label, c.x + 6, y + 7, { width: c.w - 12 }));
        y += 24;
        doc.font('Helvetica').fontSize(9).fillColor('#222222');
      }

      const item = lineItems[i];
      if (i % 2 === 1) {
        doc.rect(54, y, pageW, rowH).fill(lightBg);
        doc.fillColor('#222222');
      }
      doc.rect(54, y + rowH, pageW, 0.5).fill('#e0e0e0');
      doc.fillColor('#222222');

      doc.text(item.patientName || '', cols[0].x + 6, y + 5, { width: cols[0].w - 12 });
      doc.text(item.date || '', cols[1].x + 6, y + 5, { width: cols[1].w - 12 });
      const clinLabel = `${item.clinicianName || ''}${item.clinicianTitle ? ` (${item.clinicianTitle})` : ''}`;
      doc.text(clinLabel, cols[2].x + 6, y + 5, { width: cols[2].w - 12 });
      doc.text(item.careType || '', cols[3].x + 6, y + 5, { width: cols[3].w - 12 });
      doc.font('Helvetica-Bold').text(formatCurrency(item.amount), cols[4].x + 6, y + 5, { width: cols[4].w - 12, align: 'right' });
      doc.font('Helvetica');
      y += rowH;
    }

    if (lineItems.length === 0) {
      doc.fillColor('#888888').text('No line items', 54, y + 8, { width: pageW, align: 'center' });
      y += 30;
    }

    // ── Totals ──
    y += 16;
    if (y > 680) { doc.addPage(); y = 54; }
    const totX = 380;
    const totW = pageW - (totX - 54);

    doc.fontSize(11).fillColor('#222222').font('Helvetica');
    doc.text('Subtotal', totX, y, { width: totW / 2 });
    doc.text(formatCurrency(invoice.subtotal), totX + totW / 2, y, { width: totW / 2, align: 'right' });
    y += 20;

    if (invoice.adjustments) {
      doc.text('Adjustments', totX, y, { width: totW / 2 });
      doc.text(formatCurrency(invoice.adjustments), totX + totW / 2, y, { width: totW / 2, align: 'right' });
      y += 20;
    }

    doc.moveTo(totX, y).lineTo(totX + totW, y).lineWidth(2).strokeColor(darkGray).stroke();
    y += 6;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#222222');
    doc.text('Total Due', totX, y, { width: totW / 2 });
    doc.text(formatCurrency(invoice.total), totX + totW / 2, y, { width: totW / 2, align: 'right' });

    // ── Footer ──
    y += 40;
    if (y > 720) { doc.addPage(); y = 54; }
    doc.moveTo(54, y).lineTo(54 + pageW, y).lineWidth(0.5).strokeColor('#dddddd').stroke();
    y += 12;
    doc.fontSize(8).fillColor('#888888').font('Helvetica');
    const payTerms = agency?.paymentTerms
      ? `Please remit payment within ${agency.paymentTerms} days.`
      : 'Payment is due upon receipt.';
    doc.text(`${payTerms} Make checks payable to ${billerName}.`, 54, y, { width: pageW });
    if (invoice.notes) {
      y += 14;
      doc.text(invoice.notes, 54, y, { width: pageW });
    }

    doc.end();
  });
}

/**
 * Append timesheet images to a PDF using pdf-lib
 */
async function normalizeImageForPdf(imgBytes) {
  return sharp(imgBytes)
    .rotate()
    .trim({ threshold: 12 })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function appendTimesheetImages(invoicePdfBytes, imagePaths) {
  const finalDoc = await PDFLibDoc.load(invoicePdfBytes);

  for (const imgPath of imagePaths) {
    if (!fs.existsSync(imgPath)) {
      console.warn(`[PDF] Image not found, skipping: ${imgPath}`);
      continue;
    }

    const rawBytes = await readFile(imgPath);
    const page = finalDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    let img;
    try {
      const normalizedBytes = await normalizeImageForPdf(rawBytes);
      img = await finalDoc.embedJpg(normalizedBytes);
    } catch (e) {
      console.warn(`[PDF] Could not normalize/embed image ${imgPath}: ${e.message}`);
      continue;
    }

    const margin = 42;
    const maxW = width - margin * 2;
    const maxH = height - margin * 2;
    const scale = Math.min(maxW / img.width, maxH / img.height) * 0.96;
    const drawW = img.width * scale;
    const drawH = img.height * scale;

    page.drawImage(img, {
      x: (width - drawW) / 2,
      y: (height - drawH) / 2,
      width: drawW,
      height: drawH
    });
  }

  return Buffer.from(await finalDoc.save());
}

/**
 * Generate a complete invoice PDF
 */
async function generateInvoicePdf(invoice, agency, billingPeriod, timesheetImagePaths = [], billerName = 'Tampa Bay OT LLC') {
  if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
  }

  const invoicePageBytes = await renderInvoicePdf(invoice, agency, billingPeriod, billerName);

  let finalBytes;
  if (timesheetImagePaths.length > 0) {
    finalBytes = await appendTimesheetImages(invoicePageBytes, timesheetImagePaths);
  } else {
    finalBytes = invoicePageBytes;
  }

  const filename = `${invoice.invoiceNumber}.pdf`;
  const outputPath = path.join(INVOICES_DIR, filename);
  fs.writeFileSync(outputPath, finalBytes);

  console.log(`[PDF] Generated: ${outputPath}`);
  return outputPath;
}

module.exports = { generateInvoicePdf, renderInvoicePdf, appendTimesheetImages };
