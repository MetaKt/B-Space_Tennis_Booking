const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  category: {
    type: String,
    enum: ['court_operations', 'court_management', 'add_ons', 'general', 'payment', 'booking_rules'],
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

settingSchema.index({ category: 1 });

module.exports = mongoose.model('Setting', settingSchema);
