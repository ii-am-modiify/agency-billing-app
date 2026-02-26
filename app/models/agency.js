const mongoose = require('mongoose');

const agencySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: { type: String },
  contactName: { type: String },
  contactEmail: { type: String },
  contactPhone: { type: String },

  // Legacy flat rate (kept for backward compat)
  billingRate: {
    default: { type: Number, default: 0 } // per hour
  },

  // Rate matrix: billing code → dollar amount per visit
  // e.g. { "P": 85, "X": 95, "HT": 120, ... }
  rates: { type: Map, of: Number, default: {} },

  paymentTerms: { type: Number, default: 30 }, // days
  active: { type: Boolean, default: true },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Agency', agencySchema);
