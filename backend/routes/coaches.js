// Coaches routes — migrated from Mongoose to Prisma
const express = require('express');
const prisma = require('../lib/prisma');
const { protect, adminAccess } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/coaches
// @desc    Get all coaches
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const isAdmin = ['admin', 'master_admin'].includes(req.user.role);
    const coaches = await prisma.coach.findMany({
      where: isAdmin ? {} : { isActive: true, isInHouse: true },
      include: { availability: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: coaches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/coaches/:id
// @desc    Get coach by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const coach = await prisma.coach.findUnique({
      where: { id: req.params.id },
      include: { availability: true },
    });
    if (!coach) {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }
    res.json({ success: true, data: coach });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/coaches/:id/schedule
// @desc    Get coach bookings/schedule
// @access  Admin
router.get('/:id/schedule', protect, adminAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {
      coachId: req.params.id,
      status: { not: 'cancelled' },
    };

    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        court: { select: { courtNumber: true, name: true } },
        user: { select: { name: true, phone: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/coaches/:id/stats
// @desc    Get coach statistics
// @access  Admin
router.get('/:id/stats', protect, adminAccess, async (req, res) => {
  try {
    const { month, year } = req.query;
    const where = {
      coachId: req.params.id,
      status: { not: 'cancelled' },
    };

    if (month && year) {
      where.date = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59),
      };
    }

    const bookings = await prisma.booking.findMany({ where });

    const stats = {
      totalSessions: bookings.length,
      totalHours: bookings.reduce((sum, b) => sum + b.duration, 0),
      totalRevenue: bookings.reduce((sum, b) => sum + b.coachPrice, 0),
      completedSessions: bookings.filter(b => b.status === 'completed').length,
      upcomingSessions: bookings.filter(b => b.status === 'upcoming').length,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/coaches
// @desc    Create a new coach
// @access  Admin
router.post('/', protect, adminAccess, async (req, res) => {
  try {
    const {
      name, nickname, phone, email, bio,
      specialization, certifications, yearsOfExperience,
      pricePerHour, pricePerSession, availability,
      isInHouse, maxDailyBookings, notes,
    } = req.body;

    const coach = await prisma.coach.create({
      data: {
        name,
        nickname: nickname || '',
        phone,
        email: email || '',
        bio: bio || '',
        specialization: specialization || [],
        certifications: certifications || [],
        yearsOfExperience: yearsOfExperience || 0,
        pricePerHour: Number(pricePerHour),
        pricePerSession: Number(pricePerSession) || 0,
        isInHouse: isInHouse !== undefined ? isInHouse : true,
        maxDailyBookings: maxDailyBookings || 8,
        notes: notes || '',
        // Nested create for availability (replaces embedded Mongoose array)
        availability: {
          create: (availability || []).map(a => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
        },
      },
      include: { availability: true },
    });

    res.status(201).json({ success: true, data: coach });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/coaches/:id
// @desc    Update coach (replaces availability entirely if provided)
// @access  Admin
router.put('/:id', protect, adminAccess, async (req, res) => {
  try {
    const {
      name, nickname, phone, email, bio,
      specialization, certifications, yearsOfExperience,
      pricePerHour, pricePerSession, availability,
      isInHouse, maxDailyBookings, notes, isActive,
    } = req.body;

    const data = {};
    if (name !== undefined)              data.name = name;
    if (nickname !== undefined)          data.nickname = nickname;
    if (phone !== undefined)             data.phone = phone;
    if (email !== undefined)             data.email = email;
    if (bio !== undefined)               data.bio = bio;
    if (specialization !== undefined)    data.specialization = specialization;
    if (certifications !== undefined)    data.certifications = certifications;
    if (yearsOfExperience !== undefined) data.yearsOfExperience = yearsOfExperience;
    if (pricePerHour !== undefined)      data.pricePerHour = Number(pricePerHour);
    if (pricePerSession !== undefined)   data.pricePerSession = Number(pricePerSession);
    if (isInHouse !== undefined)         data.isInHouse = isInHouse;
    if (maxDailyBookings !== undefined)  data.maxDailyBookings = maxDailyBookings;
    if (notes !== undefined)             data.notes = notes;
    if (isActive !== undefined)          data.isActive = isActive;

    // If availability is provided, delete old rows and insert new ones
    if (availability !== undefined) {
      data.availability = {
        deleteMany: {},
        create: availability.map(a => ({
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
        })),
      };
    }

    const coach = await prisma.coach.update({
      where: { id: req.params.id },
      data,
      include: { availability: true },
    });

    res.json({ success: true, data: coach });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/coaches/:id
// @desc    Soft-delete coach (set isActive = false)
// @access  Admin
router.delete('/:id', protect, adminAccess, async (req, res) => {
  try {
    await prisma.coach.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Coach deactivated' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
