const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  timesheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timesheet' },
  patientName: String,
  date: String,
  clinicianName: String,
  clinicianTitle: String,
  timeIn: String,
  timeOut: String,
  durationMinutes: Number,
  careType: String,
  rate: Number,    // per hour
  amount: Number   // calculated
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  billingPeriodId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingPeriod', required: true },
  timesheetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Timesheet' }],
  lineItems: [lineItemSchema],

  subtotal: { type: Number, default: 0 },
  adjustments: { type: Number, default: 0 },
  total: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'void'],
    default: 'draft'
  },

  pdfPath: { type: String }, // local path inside container
  gmailDraftId: { type: String },

  dueDate: { type: Date },
  sentAt: { type: Date },
  paidAt: { type: Date },
  paidAmount: { type: Number },
  paymentNotes: { type: String },

  notes: { type: String }
}, { timestamps: true });

// Auto-generate invoice number before save
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Invoice').countDocuments();
    const year = new Date().getFullYear();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
