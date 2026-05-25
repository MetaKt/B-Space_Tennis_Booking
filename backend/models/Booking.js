const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    default: () => 'BK-' + uuidv4().substring(0, 8).toUpperCase()
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  court: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Court',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Booking date is required']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required']
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  coachOption: {
    type: String,
    enum: ['none', 'in_house', 'outside'],
    default: 'none'
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
    default: null
  },
  outsideCoachName: {
    type: String,
    default: ''
  },
  courtPrice: {
    type: Number,
    required: true,
    min: 0
  },
  coachPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  addOns: [{
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number, default: 1 }
  }],
  addOnsTotal: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  creditUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'submitted', 'confirmed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentSlip: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['upcoming', 'completed', 'cancelled', 'no_show'],
    default: 'upcoming'
  },
  bookingStatus: {
    type: String,
    enum: ['provisional', 'confirmed', 'cancelled'],
    default: 'provisional'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ court: 1, date: 1 });
bookingSchema.index({ date: 1, startTime: 1 });
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ paymentStatus: 1 });
// TTL index to automatically delete expired provisional bookings
bookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('Booking', bookingSchema);
