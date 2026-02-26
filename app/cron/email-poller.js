/**
 * Email Poller Cron Job
 * Checks Gmail inbox every 5 minutes for new timesheet attachments
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const gmail = require('../services/gmail');
const { processTimesheet } = require('../services/ocr');
const Timesheet = require('../models/timesheet');
const { getCurrentPeriod } = require('../services/billing');

const IMAGES_DIR = '/app/data/images';

async function pollAndProcess() {
  const status = gmail.getStatus();
  if (!status.configured) return; // Skip if Gmail not connected

  try {
    const emails = await gmail.pollInbox();
    if (emails.length === 0) return;

    console.log(`[EmailPoller] Found ${emails.length} emails with attachments`);
    const period = await getCurrentPeriod();

    for (const email of emails) {
      for (const attachment of email.attachments) {
        // Check if we've already processed this attachment
        const existing = await Timesheet.findOne({ emailId: `${email.id}_${attachment.attachmentId}` });
        if (existing) continue;

        const filename = `email_${email.id}_${attachment.filename}`;
        const outputPath = path.join(IMAGES_DIR, filename);

        try {
          await gmail.downloadAttachment(email.id, attachment.attachmentId, outputPath);

          const ts = new Timesheet({
            sourceType: 'email',
            originalFilename: attachment.filename,
            imagePath: outputPath,
            emailId: `${email.id}_${attachment.attachmentId}`,
            emailSender: email.from,
            emailSubject: email.subject,
            emailDate: email.date,
            billingPeriodId: period._id,
            status: 'pending'
          });
          await ts.save();

          // Queue OCR processing
          setImmediate(() => {
            processTimesheet(Timesheet, ts._id.toString())
              .catch(err => console.error('[EmailPoller] OCR error:', err.message));
          });

          console.log(`[EmailPoller] Queued timesheet from ${email.from}: ${attachment.filename}`);
        } catch (err) {
          console.error(`[EmailPoller] Failed to process attachment ${attachment.filename}:`, err.message);
        }
      }

      // Mark email as read after processing all attachments
      await gmail.markAsRead(email.id).catch(() => {});
    }
  } catch (err) {
    console.error('[EmailPoller] Poll cycle error:', err.message);
  }
}

function start() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', pollAndProcess);
  console.log('[EmailPoller] Started — polling every 5 minutes');
}

module.exports = { start, pollAndProcess };
