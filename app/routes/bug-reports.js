const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = '/app/data/bug-reports';

// POST /api/bug-reports — save a bug report with screenshot + logs
router.post('/', async (req, res) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

    const { screenshot, consoleErrors, networkErrors, url, description, userAgent, timestamp } = req.body;

    const id = `bug-${Date.now()}`;
    const reportDir = path.join(REPORTS_DIR, id);
    fs.mkdirSync(reportDir, { recursive: true });

    // Save screenshot
    if (screenshot) {
      const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(reportDir, 'screenshot.png'), Buffer.from(base64Data, 'base64'));
    }

    // Save report JSON
    const report = {
      id,
      url,
      description: description || '(no description)',
      userAgent,
      timestamp: timestamp || new Date().toISOString(),
      consoleErrors: consoleErrors || [],
      networkErrors: networkErrors || []
    };
    fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));

    console.log(`[BugReport] Saved: ${id} — "${description || 'no description'}"`);
    res.json({ success: true, reportId: id });
  } catch (err) {
    console.error('[BugReport] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bug-reports — list all reports
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) return res.json([]);
    const dirs = fs.readdirSync(REPORTS_DIR).filter(d =>
      fs.statSync(path.join(REPORTS_DIR, d)).isDirectory()
    ).sort().reverse();

    const reports = dirs.map(d => {
      const reportPath = path.join(REPORTS_DIR, d, 'report.json');
      if (!fs.existsSync(reportPath)) return null;
      return JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    }).filter(Boolean);

    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bug-reports/:id/screenshot — serve screenshot image
router.get('/:id/screenshot', (req, res) => {
  const imgPath = path.join(REPORTS_DIR, req.params.id, 'screenshot.png');
  if (!fs.existsSync(imgPath)) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', 'image/png');
  res.sendFile(imgPath);
});

module.exports = router;
