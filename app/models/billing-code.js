const mongoose = require('mongoose');

const billingCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  defaultRate: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('BillingCode', billingCodeSchema);
