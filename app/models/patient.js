const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
  clinicalRecordNumber: { type: String },
  address: { type: String },
  active: { type: Boolean, default: true },
  notes: { type: String }
}, { timestamps: true });

// Unique sparse index — allows multiple nulls but no duplicate record numbers
patientSchema.index({ clinicalRecordNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Patient', patientSchema);
