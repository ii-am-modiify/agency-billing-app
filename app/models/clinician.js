const mongoose = require('mongoose');

const clinicianSchema = new mongoose.Schema({
  name: { type: String, required: true },
  title: { type: String }, // PTA, RN, OT, PT, etc.
  email: { type: String },
  phone: { type: String },
  payRate: { type: Number, default: 0 }, // per visit
  agencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agency' }],
  active: { type: Boolean, default: true },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Clinician', clinicianSchema);
