// Auth routes — migrated from Mongoose to Prisma
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { generateOTP, sendOTP } = require('../utils/otp');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ─── Auth rate limiter ────────────────────────────────────────────────────────
// 10 requests per 15 minutes per IP on sensitive auth endpoints.
// Prevents OTP abuse (burning SMS credits) and brute-force login attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

// Thai phone number: starts with 0, exactly 10 digits
const isValidThaiPhone = (phone) => /^0[0-9]{9}$/.test(phone);

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRE || '15m',
});

const generateRefreshToken = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
  expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
});

// Store a refresh token record in DB
const storeRefreshToken = async (userId, token) => {
  const expireDays = parseInt(process.env.JWT_REFRESH_EXPIRE) || 30;
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000),
    },
  });
};

// @route   POST /api/auth/register
// @desc    Register new user and send OTP
// @access  Public
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, phone, email, age, gender, dateOfBirth, occupation } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    if (!isValidThaiPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Must be 10 digits starting with 0 (e.g., 0812345678)',
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || '',
        age: age || null,
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        occupation: occupation || '',
      },
    });

    // Generate and send OTP
    const otp = generateOTP();
    const expireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES) || 5;

    await prisma.oTP.create({
      data: {
        phone,
        otp,
        expiresAt: new Date(Date.now() + expireMinutes * 60 * 1000),
      },
    });

    await sendOTP(phone, otp);

    res.status(201).json({
      success: true,
      message: 'Registration successful. OTP sent to your phone.',
      data: { userId: user.id, phone: user.phone },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Login — send OTP to registered phone
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    if (!isValidThaiPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Must be 10 digits starting with 0 (e.g., 0812345678)',
      });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this phone number' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    // Delete all old OTPs for this phone
    await prisma.oTP.deleteMany({ where: { phone } });

    const otp = generateOTP();
    const expireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES) || 5;

    await prisma.oTP.create({
      data: {
        phone,
        otp,
        expiresAt: new Date(Date.now() + expireMinutes * 60 * 1000),
      },
    });

    await sendOTP(phone, otp);

    res.json({
      success: true,
      message: 'OTP sent to your phone',
      data: { phone, name: user.name },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and return JWT token
// @access  Public
router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    // Find the active OTP record by phone only — we compare the value manually
    // so we can increment the attempt counter on wrong guesses.
    const otpRecord = await prisma.oTP.findFirst({
      where: { phone, verified: false },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Check expiry
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Check max attempts before comparing — locks out after 5 wrong tries
    if (otpRecord.attempts >= 5) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Please request a new OTP.' });
    }

    // Compare OTP value — increment counter on mismatch so brute-force is tracked
    if (otpRecord.otp !== otp) {
      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = 4 - otpRecord.attempts; // attempts is the value before this increment
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Invalid OTP. No attempts remaining — please request a new OTP.',
      });
    }

    // Mark as verified
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    await storeRefreshToken(user.id, refreshToken);

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        token,
        refreshToken,
        user: {
          _id: user.id,      // keep _id key for frontend compatibility
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          credit: user.credit,
          preferredLanguage: user.preferredLanguage,
        },
      },
    });
  } catch (error) {
    console.error('OTP verify error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
// @access  Public
router.post('/resend-otp', authLimiter, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await prisma.oTP.deleteMany({ where: { phone } });

    const otp = generateOTP();
    const expireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES) || 5;

    await prisma.oTP.create({
      data: {
        phone,
        otp,
        expiresAt: new Date(Date.now() + expireMinutes * 60 * 1000),
      },
    });

    await sendOTP(phone, otp);

    res.json({ success: true, message: 'OTP resent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/refresh
// @desc    Issue new access token from refresh token
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    // Verify the JWT signature first
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Check it exists in DB and is not expired
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Refresh token revoked or expired' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }

    // Rotate: delete old refresh token, issue new pair
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    const newAccessToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);
    await storeRefreshToken(user.id, newRefreshToken);

    res.json({
      success: true,
      data: { token: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/logout
// @desc    Revoke refresh token
// @access  Public
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = router;
