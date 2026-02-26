/**
 * Gmail Service
 * 
 * Provides a functional interface for Gmail operations.
 * When Gmail credentials are not configured, all methods return mock/stub responses.
 * This allows the app to function fully for manual uploads without Gmail.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

let gmailClient = null;
let isConfigured = false;

/**
 * Initialize Gmail client from service account credentials or OAuth2
 */
async function init() {
  const credPath = process.env.GMAIL_CREDENTIALS_PATH;
  const userEmail = process.env.GMAIL_USER_EMAIL;

  if (!credPath || !fs.existsSync(credPath) || !userEmail) {
    console.log('[Gmail] Credentials not configured — running in stub mode');
    isConfigured = false;
    return false;
  }

  try {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

    let auth;
    if (creds.type === 'service_account') {
      // Service account with domain-wide delegation
      auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/drive'
        ],
        clientOptions: { subject: userEmail }
      });
    } else {
      // OAuth2 refresh token
      auth = new google.auth.OAuth2(
        creds.client_id,
        creds.client_secret,
        creds.redirect_uri
      );
      auth.setCredentials({ refresh_token: creds.refresh_token });
    }

    const authClient = await auth.getClient();
    gmailClient = google.gmail({ version: 'v1', auth: authClient });
    isConfigured = true;
    console.log('[Gmail] Client initialized successfully');
    return true;
  } catch (err) {
    console.warn('[Gmail] Initialization failed:', err.message);
    isConfigured = false;
    return false;
  }
}

/**
 * Get Gmail connection status
 */
function getStatus() {
  return {
    configured: isConfigured,
    mode: isConfigured ? 'live' : 'stub',
    userEmail: process.env.GMAIL_USER_EMAIL || null
  };
}

/**
 * Poll Gmail inbox for emails with image attachments
 * @returns {Array} array of email objects with attachment metadata
 */
async function pollInbox() {
  if (!isConfigured) {
    // Stub: return empty array (no emails without connection)
    return [];
  }

  try {
    const res = await gmailClient.users.messages.list({
      userId: 'me',
      q: 'has:attachment is:unread',
      maxResults: 50
    });

    const messages = res.data.messages || [];
    const results = [];

    for (const msg of messages) {
      const full = await gmailClient.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });

      const headers = full.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      const attachments = [];
      const parts = full.data.payload.parts || [];

      for (const part of parts) {
        if (part.filename && /\.(jpg|jpeg|png)$/i.test(part.filename)) {
          attachments.push({
            messageId: msg.id,
            attachmentId: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType
          });
        }
      }

      if (attachments.length > 0) {
        results.push({
          id: msg.id,
          subject,
          from,
          date: new Date(date),
          attachments
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[Gmail] pollInbox error:', err.message);
    return [];
  }
}

/**
 * Download an email attachment
 * @param {string} messageId - Gmail message ID
 * @param {string} attachmentId - Gmail attachment ID
 * @param {string} outputPath - local path to save the file
 */
async function downloadAttachment(messageId, attachmentId, outputPath) {
  if (!isConfigured) {
    throw new Error('Gmail not configured');
  }

  const res = await gmailClient.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId
  });

  const data = Buffer.from(res.data.data, 'base64url');
  fs.writeFileSync(outputPath, data);
  return outputPath;
}

/**
 * Mark an email as read
 */
async function markAsRead(messageId) {
  if (!isConfigured) return;

  await gmailClient.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] }
  });
}

/**
 * Create a Gmail draft for invoice delivery
 * @param {object} options
 * @param {string} options.to - recipient email
 * @param {string} options.subject - email subject
 * @param {string} options.bodyHtml - HTML email body
 * @param {string} options.pdfPath - path to invoice PDF
 * @returns {string|null} Gmail draft ID
 */
async function createInvoiceDraft({ to, subject, bodyHtml, pdfPath }) {
  if (!isConfigured) {
    console.log(`[Gmail] STUB: Would create draft to ${to}: "${subject}"`);
    return `stub-draft-${Date.now()}`;
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBytes.toString('base64');
  const filename = path.basename(pdfPath);

  // Build MIME message
  const boundary = `boundary_${Date.now()}`;
  const mime = [
    `MIME-Version: 1.0`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    '',
    bodyHtml,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    '',
    pdfBase64,
    `--${boundary}--`
  ].join('\r\n');

  const encodedMime = Buffer.from(mime).toString('base64url');

  const res = await gmailClient.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw: encodedMime }
    }
  });

  return res.data.id;
}

/**
 * Send an existing Gmail draft by its draft ID
 */
async function sendDraft(draftId) {
  if (!isConfigured) {
    console.log(`[Gmail] STUB: Would send draft ${draftId}`);
    return { id: `stub-sent-${Date.now()}`, status: 'stub' };
  }

  const res = await gmailClient.users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId }
  });

  console.log(`[Gmail] Draft ${draftId} sent → message ${res.data.id}`);
  return res.data;
}

/**
 * Send a new email directly (no draft step)
 */
async function sendEmail({ to, subject, bodyHtml, pdfPath }) {
  if (!isConfigured) {
    console.log(`[Gmail] STUB: Would send email to ${to}: "${subject}"`);
    return { id: `stub-sent-${Date.now()}`, status: 'stub' };
  }

  const boundary = `boundary_${Date.now()}`;
  const parts = [
    `MIME-Version: 1.0`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    '',
    bodyHtml,
    ''
  ];

  if (pdfPath && fs.existsSync(pdfPath)) {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBytes.toString('base64');
    const filename = path.basename(pdfPath);
    parts.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      `Content-Transfer-Encoding: base64`,
      '',
      pdfBase64
    );
  }

  parts.push(`--${boundary}--`);
  const encodedMime = Buffer.from(parts.join('\r\n')).toString('base64url');

  const res = await gmailClient.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMime }
  });

  console.log(`[Gmail] Email sent to ${to} → message ${res.data.id}`);
  return res.data;
}

module.exports = { init, getStatus, pollInbox, downloadAttachment, markAsRead, createInvoiceDraft, sendDraft, sendEmail };
