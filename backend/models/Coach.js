const mongoose = require('mongoose');

const coachAvailabilitySchema = new mongoose.Schema({
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  }
}, { _id: false });

const coachSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Coach name is required'],
    trim: true
  },
  nickname: {
    type: String,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: 1000
  },
  specialization: {
    type: [String],
    default: [],
    enum: ['beginner', 'intermediate', 'advanced', 'kids', 'competition', 'fitness', 'strategy']
  },
  certifications: {
    type: [String],
    default: []
  },
  yearsOfExperience: {
    type: Number,
    default: 0,
    min: 0
  },
  pricePerHour: {
    type: Number,
    required: [true, 'Price per hour is required'],
    min: 0
  },
  pricePerSession: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  availability: [coachAvailabilitySchema],
  isActive: {
    type: Boolean,
    default: true
  },
  isInHouse: {
    type: Boolean,
    default: true
  },
  maxDailyBookings: {
    type: Number,
    default: 8,
    min: 1
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

coachSchema.index({ isActive: 1 });
coachSchema.index({ specialization: 1 });
coachSchema.index({ pricePerHour: 1 });

module.exports = mongoose.model('Coach', coachSchema);
