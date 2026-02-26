const mongoose = require('mongoose');

const billingPeriodSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  label: { type: String }, // e.g. "02-10-2026 to 02-24-2026"
  status: {
    type: String,
    enum: ['open', 'closed', 'invoiced'],
    default: 'open'
  },
  invoicesGenerated: { type: Boolean, default: false },
  closedAt: { type: Date }
}, { timestamps: true });

// Index for fast date-range period lookups
billingPeriodSchema.index({ startDate: 1, endDate: 1 });

billingPeriodSchema.pre('save', function(next) {
  if (!this.label) {
    const fmt = d => d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    this.label = `${fmt(this.startDate)} to ${fmt(this.endDate)}`;
  }
  next();
});

module.exports = mongoose.model('BillingPeriod', billingPeriodSchema);
