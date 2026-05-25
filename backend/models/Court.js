const mongoose = require('mongoose');

const courtSchema = new mongoose.Schema({
  courtNumber: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  surface: {
    type: String,
    enum: ['hard', 'clay', 'grass', 'synthetic'],
    default: 'hard'
  },
  pricePerHour: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  openTime: {
    type: String,
    default: '06:00'
  },
  closeTime: {
    type: String,
    default: '22:00'
  },
  image: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Court', courtSchema);
