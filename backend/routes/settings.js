// Settings routes — migrated from Mongoose to Prisma
const express = require('express');
const prisma = require('../lib/prisma');
const { protect, adminAccess } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/settings
// @desc    Get all settings (optionally filtered by category)
// @access  Admin
router.get('/', protect, adminAccess, async (req, res) => {
  try {
    const { category } = req.query;
    const settings = await prisma.setting.findMany({
      where: category ? { category } : {},
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/settings/public
// @desc    Get public settings (add-ons, booking rules, payment, court_operations)
// @access  Private
router.get('/public', protect, async (req, res) => {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        category: { in: ['add_ons', 'booking_rules', 'payment', 'court_operations'] },
      },
    });

    const formatted = {};
    settings.forEach(s => {
      if (!formatted[s.category]) formatted[s.category] = {};
      formatted[s.category][s.key] = s.value;
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/settings/:key
// @desc    Upsert a setting by key
// @access  Admin
router.put('/:key', protect, adminAccess, async (req, res) => {
  try {
    const { value, category, label, description } = req.body;

    const setting = await prisma.setting.upsert({
      where: { key: req.params.key },
      update: {
        value,
        category: category || 'general',
        label: label || req.params.key,
        description: description || '',
      },
      create: {
        key: req.params.key,
        value,
        category: category || 'general',
        label: label || req.params.key,
        description: description || '',
      },
    });

    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/settings/bulk
// @desc    Upsert multiple settings at once
// @access  Admin
router.post('/bulk', protect, adminAccess, async (req, res) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ success: false, message: 'Settings must be an array' });
    }

    // Prisma doesn't have native bulkWrite — use transaction of individual upserts
    const upserts = settings.map(s =>
      prisma.setting.upsert({
        where: { key: s.key },
        update: {
          value: s.value,
          category: s.category || 'general',
          label: s.label || s.key,
          description: s.description || '',
        },
        create: {
          key: s.key,
          value: s.value,
          category: s.category || 'general',
          label: s.label || s.key,
          description: s.description || '',
        },
      })
    );

    const results = await prisma.$transaction(upserts);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/settings/:key
// @desc    Delete a setting
// @access  Admin
router.delete('/:key', protect, adminAccess, async (req, res) => {
  try {
    await prisma.setting.delete({ where: { key: req.params.key } });
    res.json({ success: true, message: 'Setting deleted' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
