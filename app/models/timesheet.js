const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  day: String,
  date: String,
  visitCode: String,
  ncCode: String,
  timeIn: String,
  timeOut: String,
  durationMinutes: Number,
  units: String
}, { _id: false });

const timesheetSchema = new mongoose.Schema({
  // Source info
  sourceType: { type: String, enum: ['email', 'upload'], default: 'upload' },
  originalFilename: { type: String },
  imagePath: { type: String }, // local filesystem path inside container
  imageHash: { type: String, index: true }, // SHA-256 hash for dedupe
  driveFileId: { type: String }, // Google Drive file ID after archival

  // Email metadata (if from Gmail)
  emailId: { type: String },
  emailSender: { type: String },
  emailSubject: { type: String },
  emailDate: { type: Date },

  // OCR extracted data
  ocrData: {
    company: String,
    year: String,
    employeeName: String,
    employeeTitle: String,
    patientName: String,
    clinicalRecordNumber: String,
    patientAddress: String,
    visits: [visitSchema],
    totalVisits: Number,
    totalUnitsOrHours: String,
    confidence: Number
  },

  // Document classification
  documentType: {
    type: String,
    enum: ['timesheet', 'discharge', 'unknown'],
    default: 'timesheet'
  },

  // Discharge pages attached to this timesheet
  dischargeDocs: [{
    imagePath: String,
    imageHash: String,
    originalFilename: String,
    addedAt: { type: Date, default: Date.now }
  }],

  // Resolved references
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
  clinicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinician' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  billingPeriodId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingPeriod' },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'processed', 'flagged', 'reviewed', 'invoiced', 'error'],
    default: 'pending'
  },
  flagReason: { type: String },
  ocrError: { type: String },

  // Manual overrides (human correction)
  manualData: { type: mongoose.Schema.Types.Mixed },
  reviewedAt: { type: Date },
  reviewedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Timesheet', timesheetSchema);
