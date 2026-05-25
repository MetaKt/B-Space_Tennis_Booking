// User routes — migrated from Mongoose to Prisma
const express = require('express');
const prisma = require('../lib/prisma');
const { protect } = require('../middleware/auth');
const { getUploader, getFilePath, FILTERS } = require('../lib/storage');

const router = express.Router();

// Avatar upload — 5 MB limit, images only, filename prefixed with user id
const upload = getUploader('avatars', {
  prefix: (req) => `avatar-${req.user.id}`,
  maxSize: 5 * 1024 * 1024,
  fileFilter: FILTERS.images,
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, age, gender, dateOfBirth, occupation, preferredLanguage } = req.body;

    const data = {};
    if (name)                    data.name = name;
    if (email !== undefined)     data.email = email;
    if (age !== undefined)       data.age = (age === '' || age === null || age === undefined) ? null : parseInt(age, 10);
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

// @route   POST /api/users/avatar
// @desc    Upload avatar
// @access  Private
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: getFilePath('avatars', req.file.filename) },
    });

    res.json({ success: true, data: { avatar: user.avatar } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
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
