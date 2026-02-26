const mongoose = require('mongoose');

const adjustmentSchema = new mongoose.Schema({
  type: { type: String, enum: ['bonus', 'deduction', 'rate-correction'], required: true },
  amount: { type: Number, required: true },
  reason: { type: String, default: '' }
}, { _id: false });

const payrollPaymentSchema = new mongoose.Schema({
  clinicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinician' },
  clinicianName: { type: String, required: true },
  clinicianTitle: { type: String, default: '' },
  billingPeriodId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingPeriod' },
  periodLabel: { type: String, default: '' },
  baseAmount: { type: Number, default: 0 },
  baseHours: { type: Number, default: 0 },
  baseVisits: { type: Number, default: 0 },
  payRate: { type: Number, default: 0 },
  adjustments: [adjustmentSchema],
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  paidDate: { type: Date },
  paymentMethod: { type: String, enum: ['check', 'direct-deposit', 'cash', 'zelle', 'other'], default: 'check' },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Auto-calculate totalAmount before save
payrollPaymentSchema.pre('save', function(next) {
  const adjTotal = (this.adjustments || []).reduce((sum, a) => sum + a.amount, 0);
  this.totalAmount = this.baseAmount + adjTotal;
  next();
});

module.exports = mongoose.model('PayrollPayment', payrollPaymentSchema);
