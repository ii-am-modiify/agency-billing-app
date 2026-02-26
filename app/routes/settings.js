const express = require('express');
const router = express.Router();
const Settings = require('../models/settings');
const Agency = require('../models/agency');
const Clinician = require('../models/clinician');
const BillingPeriod = require('../models/billing-period');
const BillingCode = require('../models/billing-code');
const Patient = require('../models/patient');
const gmail = require('../services/gmail');

const DEFAULT_BILLING_CODES = [
  { code: 'P',       description: 'Patient Visit (PT, OT, SN, etc.)', defaultRate: 85 },
  { code: 'X',       description: 'Psych RN Visit',                   defaultRate: 95 },
  { code: 'HT',      description: 'High Tech Infusion',               defaultRate: 120 },
  { code: 'S/U',     description: 'Sign Up Visit',                    defaultRate: 75 },
  { code: 'WC',      description: 'Wound Care',                       defaultRate: 110 },
  { code: 'SV',      description: 'Supervisory Visit',                defaultRate: 60 },
  { code: 'Hmk',     description: 'Homemaker',                        defaultRate: 45 },
  { code: 'EVAL',    description: 'Evaluation',                       defaultRate: 150 },
  { code: 'RE-EVAL', description: 'Re-evaluation',                    defaultRate: 120 }
];

// ─── General Settings ────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    res.json(await Settings.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    await Promise.all(Object.entries(req.body).map(([k, v]) => Settings.set(k, v)));
    res.json(await Settings.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Gmail ───────────────────────────────────────────────────────────────────

router.get('/gmail/status', (req, res) => res.json(gmail.getStatus()));

// ─── Billing Codes ───────────────────────────────────────────────────────────

// GET /api/settings/billing-codes — list (seeds defaults on first call)
router.get('/billing-codes', async (req, res) => {
  try {
    let codes = await BillingCode.find({ active: true }).sort({ code: 1 });
    if (codes.length === 0) {
      await BillingCode.insertMany(DEFAULT_BILLING_CODES);
      codes = await BillingCode.find({ active: true }).sort({ code: 1 });
    }
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/billing-codes — create
router.post('/billing-codes', async (req, res) => {
  try {
    const doc = new BillingCode(req.body);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/settings/billing-codes/:id — update
router.put('/billing-codes/:id', async (req, res) => {
  try {
    const doc = await BillingCode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/settings/billing-codes/:id — soft delete
router.delete('/billing-codes/:id', async (req, res) => {
  try {
    const doc = await BillingCode.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agencies ────────────────────────────────────────────────────────────────

router.get('/agencies', async (req, res) => {
  try {
    res.json(await Agency.find({ active: true }).sort({ name: 1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/agencies/all', async (req, res) => {
  try {
    res.json(await Agency.find().sort({ name: 1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agencies', async (req, res) => {
  try {
    const doc = new Agency(req.body);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/agencies/:id', async (req, res) => {
  try {
    const doc = await Agency.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/agencies/:id', async (req, res) => {
  try {
    const doc = await Agency.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Billing Periods ─────────────────────────────────────────────────────────

router.get('/billing-periods', async (req, res) => {
  try {
    res.json(await BillingPeriod.find().sort({ startDate: -1 }).limit(100));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/billing-periods', async (req, res) => {
  try {
    const doc = new BillingPeriod(req.body);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Clinicians ───────────────────────────────────────────────────────────────

router.get('/clinicians', async (req, res) => {
  try {
    res.json(await Clinician.find({ active: true }).populate('agencies', 'name').sort({ name: 1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/clinicians', async (req, res) => {
  try {
    const doc = new Clinician(req.body);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/clinicians/:id', async (req, res) => {
  try {
    const doc = await Clinician.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clinicians/:id', async (req, res) => {
  try {
    const doc = await Clinician.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/billing-periods/:id
router.put('/billing-periods/:id', async (req, res) => {
  try {
    const doc = await BillingPeriod.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/settings/billing-periods/:id
router.delete('/billing-periods/:id', async (req, res) => {
  try {
    await BillingPeriod.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Patients ─────────────────────────────────────────────────────────────────

router.get('/patients', async (req, res) => {
  try {
    res.json(await Patient.find({ active: true }).populate('agencyId', 'name').sort({ name: 1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/patients/all', async (req, res) => {
  try {
    res.json(await Patient.find().populate('agencyId', 'name').sort({ name: 1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/patients', async (req, res) => {
  try {
    const doc = new Patient(req.body);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/patients/:id', async (req, res) => {
  try {
    const doc = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/patients/:id', async (req, res) => {
  try {
    const doc = await Patient.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
