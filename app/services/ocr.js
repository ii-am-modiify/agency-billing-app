const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

let client = null;

/**
 * Levenshtein distance between two strings
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] 
        ? dp[i-1][j-1] 
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy match an OCR name against existing records in a Model.
 * Returns the best match if similarity > 70%, otherwise null.
 * @param {Model} Model - Mongoose model with a 'name' field
 * @param {string} ocrName - the OCR-extracted name
 * @returns {Document|null}
 */
async function fuzzyMatch(Model, ocrName) {
  if (!ocrName) return null;
  
  // First try exact (case-insensitive)
  const exact = await Model.findOne({ 
    name: { $regex: new RegExp(`^${ocrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  });
  if (exact) return exact;

  // Fuzzy match against all records
  // Support both { status: 'active' } and { active: true } patterns
  const filter = Model.schema.paths.active ? { active: true } : { status: 'active' };
  const all = await Model.find(filter).select('name').lean();
  if (all.length === 0) return null;

  const ocrLower = ocrName.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;

  for (const record of all) {
    const recLower = record.name.toLowerCase().trim();
    const maxLen = Math.max(ocrLower.length, recLower.length);
    if (maxLen === 0) continue;
    
    const dist = levenshtein(ocrLower, recLower);
    const similarity = 1 - (dist / maxLen);
    
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = record;
    }
  }

  // Threshold: 70% similarity to match
  if (bestMatch && bestScore >= 0.7) {
    return await Model.findById(bestMatch._id);
  }

  return null;
}

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const CLASSIFY_PROMPT = `Look at this medical/clinical document image. Classify it as ONE of:

- "timesheet" — a clinical visit log / timesheet with rows of visits, dates, times in/out, patient name, employee name, billing codes
- "discharge" — a discharge summary, plan of care, physician orders, medical narrative, or any multi-paragraph clinical document that is NOT a timesheet
- "unknown" — cannot determine

Reply with ONLY the JSON: {"type": "timesheet"} or {"type": "discharge"} or {"type": "unknown"}
Nothing else.`;

const OCR_PROMPT = `You are an expert at reading handwritten medical homecare timesheet forms. Extract all information carefully and accurately from this clinical timesheet image.

CRITICAL RULES — read these before extracting anything:

1. PATIENT NAME FORMAT: Patient names on these forms are written in "Last, First" order (e.g., "Rosa, Charon" means Last=Rosa, First=Charon). Preserve the exact order as written — do NOT swap or reorder names. Output exactly as it appears on the form including the comma.

2. HANDWRITING ACCURACY: Read every letter carefully. Do not guess or substitute similar-looking names.
   - Common employee on these forms: "Julio del Valle" (PTA). Read carefully — the name is "Julio", NOT "Julia" or "Jose". The letters J-U-L-I-O must all be present.
   - If you are unsure of any character, lower the confidence score accordingly.

3. VISIT CODES (VERY IMPORTANT): Extract the exact visit/treatment code written in the code/treatment column for EACH row.
   - Expected values include: EVAL, RE-EVAL, DC, P, X, HT, S/U, WC, SV, Hmk.
   - Do NOT replace treatment codes with employee title (PTA/RN/etc). Title is separate.
   - If handwriting is ambiguous, choose the closest valid code ONLY when there is clear evidence; otherwise set null and lower confidence.

Return ONLY valid JSON with this exact structure:
{
  "company": "healthcare agency name printed on form",
  "year": "year from the form",
  "employee_name": "clinician full name as written",
  "employee_title": "PTA, RN, OT, PT, etc.",
  "patient_name": "patient name EXACTLY as written — Last, First format with comma",
  "clinical_record_number": "record number or null",
  "patient_address": "full patient address or null",
  "visits": [
    {
      "day": "Mon/Tue/Wed/Thu/Fri/Sat/Sun",
      "date": "M/DD format",
      "visit_code": "billing/treatment code exactly as written (EVAL, RE-EVAL, DC, P, X, HT, S/U, WC, SV, Hmk, or other) or null",
      "nc_code": "NC code or null",
      "time_in": "H:MM AM/PM or 24h",
      "time_out": "H:MM AM/PM or 24h",
      "duration_minutes": <calculated integer>,
      "units": "units value or null"
    }
  ],
  "total_visits": <integer>,
  "total_units_or_hours": "total value or null",
  "confidence": <0.0 to 1.0 overall confidence in the extraction>
}

For duration_minutes: calculate from time_in and time_out. If times are unclear, set to null.
For confidence: 1.0 = perfectly legible, 0.5 = hard to read, 0.0 = unreadable. Lower confidence when names or codes are ambiguous.
Confidence below 0.8 triggers human review — be honest about uncertainty.
Only return the JSON object, no other text.`;

/**
 * OCR a single image file using Claude Vision
 * @param {string} imagePath - path to image file
 * @returns {object} extracted OCR data
 */
async function processImage(imagePath) {
  const claude = getClient();

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const response = await claude.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image
            }
          },
          {
            type: 'text',
            text: OCR_PROMPT
          }
        ]
      }
    ]
  });

  const text = response.content[0].text.trim();

  // Strip markdown code blocks if present
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  const parsed = JSON.parse(jsonText);

  // Normalize to camelCase for internal use
  return {
    company: parsed.company || null,
    year: parsed.year || null,
    employeeName: parsed.employee_name || null,
    employeeTitle: parsed.employee_title || null,
    patientName: parsed.patient_name || null,
    clinicalRecordNumber: parsed.clinical_record_number || null,
    patientAddress: parsed.patient_address || null,
    visits: (parsed.visits || []).map(v => ({
      day: v.day,
      date: v.date,
      visitCode: v.visit_code,
      ncCode: v.nc_code,
      timeIn: v.time_in,
      timeOut: v.time_out,
      durationMinutes: v.duration_minutes,
      units: v.units
    })),
    totalVisits: parsed.total_visits || 0,
    totalUnitsOrHours: parsed.total_units_or_hours || null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
  };
}

/**
 * Process a timesheet document: run OCR and update status
 * @param {object} Timesheet - Mongoose model
 * @param {string} timesheetId - document ID
 */
async function processTimesheet(Timesheet, timesheetId) {
  const doc = await Timesheet.findById(timesheetId);
  if (!doc) throw new Error(`Timesheet ${timesheetId} not found`);

  doc.status = 'processing';
  await doc.save();

  try {
    const ocrData = await processImage(doc.imagePath);
    doc.ocrData = ocrData;

    // Auto-create or link Agency (with fuzzy matching)
    if (ocrData.company) {
      try {
        const Agency = require('../models/agency');
        let agency = await fuzzyMatch(Agency, ocrData.company);
        if (!agency) {
          agency = await Agency.create({ name: ocrData.company, status: 'active' });
          console.log(`[OCR] Auto-created agency: ${ocrData.company}`);
        } else {
          console.log(`[OCR] Fuzzy matched agency: "${ocrData.company}" → "${agency.name}"`);
        }
        doc.agencyId = agency._id;
      } catch (e) {
        console.error('[OCR] Agency auto-create error:', e.message);
      }
    }

    // Auto-create or link Clinician (with fuzzy matching)
    if (ocrData.employeeName) {
      try {
        const Clinician = require('../models/clinician');
        let clinician = await fuzzyMatch(Clinician, ocrData.employeeName);
        if (!clinician) {
          clinician = await Clinician.create({ 
            name: ocrData.employeeName, 
            title: ocrData.employeeTitle || '',
            status: 'active' 
          });
          console.log(`[OCR] Auto-created clinician: ${ocrData.employeeName} (${ocrData.employeeTitle || 'N/A'})`);
        } else {
          console.log(`[OCR] Fuzzy matched clinician: "${ocrData.employeeName}" → "${clinician.name}"`);
        }
        doc.clinicianId = clinician._id;
      } catch (e) {
        console.error('[OCR] Clinician auto-create error:', e.message);
      }
    }

    // Auto-create or link Patient (with fuzzy matching)
    if (ocrData.patientName) {
      try {
        const Patient = require('../models/patient');
        let patient = await fuzzyMatch(Patient, ocrData.patientName);
        if (!patient) {
          patient = await Patient.create({
            name: ocrData.patientName,
            agencyId: doc.agencyId || null,
            clinicalRecordNumber: ocrData.clinicalRecordNumber || null,
            address: ocrData.patientAddress || null
          });
          console.log(`[OCR] Auto-created patient: ${ocrData.patientName}`);
        } else {
          console.log(`[OCR] Fuzzy matched patient: "${ocrData.patientName}" → "${patient.name}"`);
          let needsSave = false;
          // Update agency link if not set
          if (!patient.agencyId && doc.agencyId) {
            patient.agencyId = doc.agencyId;
            needsSave = true;
          }
          // Update clinical record number if not set and OCR found one
          if (!patient.clinicalRecordNumber && ocrData.clinicalRecordNumber) {
            patient.clinicalRecordNumber = ocrData.clinicalRecordNumber;
            needsSave = true;
            console.log(`[OCR] Updated patient "${patient.name}" record #: ${ocrData.clinicalRecordNumber}`);
          }
          if (needsSave) await patient.save();
        }
        doc.patientId = patient._id;
      } catch (e) {
        console.error('[OCR] Patient auto-create error:', e.message);
      }
    }

    // Flag if low confidence
    if (ocrData.confidence < 0.8) {
      doc.status = 'flagged';
      doc.flagReason = `Low OCR confidence: ${(ocrData.confidence * 100).toFixed(0)}%`;
    } else {
      doc.status = 'processed';
    }
  } catch (err) {
    doc.status = 'error';
    doc.ocrError = err.message;
    console.error(`[OCR] Error processing ${timesheetId}:`, err.message);
  }

  await doc.save();
  return doc;
}

/**
 * Classify a document image as timesheet, discharge, or unknown.
 * Uses Sonnet for speed/cost — just needs layout recognition, not handwriting.
 */
async function classifyDocument(imagePath) {
  const claude = getClient();
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

  try {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text', text: CLASSIFY_PROMPT }
        ]
      }]
    });

    const text = response.content[0].text.trim();
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonText);
    return parsed.type || 'unknown';
  } catch (e) {
    console.error('[OCR] Classification error:', e.message);
    return 'unknown';
  }
}

module.exports = { processImage, processTimesheet, classifyDocument };
