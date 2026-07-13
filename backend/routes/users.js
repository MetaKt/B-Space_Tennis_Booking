// User routes — migrated from Mongoose to Prisma
const express = require('express');
const prisma = require('../lib/prisma');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, gender, dateOfBirth, occupation, preferredLanguage } = req.body;

    const data = {};
    if (name)                    data.name = name;
    if (email !== undefined)     data.email = email;
    if (gender !== undefined)    data.gender = gender || null;
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (occupation !== undefined) data.occupation = occupation;
    if (preferredLanguage)       data.preferredLanguage = preferredLanguage;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   GET /api/users/credit
// @desc    Get user credit balance
// @access  Private
router.get('/credit', protect, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { credit: true },
    });
    res.json({ success: true, data: { credit: user.credit } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/users/language
// @desc    Update preferred language
// @access  Private
router.put('/language', protect, async (req, res) => {
  try {
    const { language } = req.body;
    if (!['en', 'th'].includes(language)) {
      return res.status(400).json({ success: false, message: 'Invalid language' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { preferredLanguage: language },
    });

    res.json({ success: true, data: { preferredLanguage: user.preferredLanguage } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
