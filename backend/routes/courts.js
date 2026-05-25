// Courts routes — migrated from Mongoose to Prisma
const express = require('express');
const prisma = require('../lib/prisma');
const { protect, adminAccess } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/courts
// @desc    Get all active courts (users) or all courts (admins)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const isAdmin = ['admin', 'master_admin'].includes(req.user.role);
    const courts = await prisma.court.findMany({
      where: isAdmin ? {} : { isActive: true },
      orderBy: { courtNumber: 'asc' },
    });
    res.json({ success: true, data: courts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/courts/:id
// @desc    Get court by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const court = await prisma.court.findUnique({ where: { id: req.params.id } });
    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }
    res.json({ success: true, data: court });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/courts
// @desc    Create a new court
// @access  Admin
router.post('/', protect, adminAccess, async (req, res) => {
  try {
    const { courtNumber, name, description, surface, pricePerHour, openTime, closeTime } = req.body;

    const existing = await prisma.court.findUnique({ where: { courtNumber: Number(courtNumber) } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Court number already exists' });
    }

    const court = await prisma.court.create({
      data: {
        courtNumber: Number(courtNumber),
        name,
        description: description || '',
        surface: surface || 'hard',
        pricePerHour: Number(pricePerHour),
        openTime: openTime || '06:00',
        closeTime: closeTime || '22:00',
      },
    });

    res.status(201).json({ success: true, data: court });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/courts/:id
// @desc    Update court
// @access  Admin
router.put('/:id', protect, adminAccess, async (req, res) => {
  try {
    const { courtNumber, name, description, surface, pricePerHour, openTime, closeTime, isActive, image } = req.body;
    const data = {};

    if (courtNumber !== undefined) data.courtNumber = Number(courtNumber);
    if (name !== undefined)        data.name = name;
    if (description !== undefined) data.description = description;
    if (surface !== undefined)     data.surface = surface;
    if (pricePerHour !== undefined) data.pricePerHour = Number(pricePerHour);
    if (openTime !== undefined)    data.openTime = openTime;
    if (closeTime !== undefined)   data.closeTime = closeTime;
    if (isActive !== undefined)    data.isActive = isActive;
    if (image !== undefined)       data.image = image;

    const court = await prisma.court.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ success: true, data: court });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/courts/:id
// @desc    Soft-delete court (set isActive = false)
// @access  Admin
router.delete('/:id', protect, adminAccess, async (req, res) => {
  try {
    const court = await prisma.court.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Court deactivated', data: court });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
