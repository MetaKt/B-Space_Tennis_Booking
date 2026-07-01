// Admin routes — migrated from Mongoose (with $aggregate) to Prisma
const express = require('express');
const prisma = require('../lib/prisma');
const { protect, adminAccess, masterOnly } = require('../middleware/auth');
const { getIO } = require('../lib/socket');
const { autoCompletePassedBookings } = require('../lib/bookingHelpers');

const router = express.Router();

// ============================================================
// DASHBOARD
// ============================================================

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats including period-based booking counts
// @access  Admin
router.get('/dashboard', protect, adminAccess, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearStart = new Date(today.getFullYear(), 0, 1);

    const [
      todayBookings,
      totalBookings,
      bookingsThisWeek,
      bookingsThisMonth,
      bookingsThisYear,
      totalUsers,
      pendingPayments,
      todayRevenue,
    ] = await prisma.$transaction([
      // Today's confirmed bookings (on-court today)
      prisma.booking.count({
        where: {
          date: { gte: today, lt: tomorrow },
          status: { not: 'cancelled' },
          bookingStatus: 'confirmed_booking',
        },
      }),
      // All-time confirmed bookings
      prisma.booking.count({ where: { bookingStatus: 'confirmed_booking' } }),
      // This week
      prisma.booking.count({
        where: { bookingStatus: 'confirmed_booking', date: { gte: weekStart } },
      }),
      // This month
      prisma.booking.count({
        where: { bookingStatus: 'confirmed_booking', date: { gte: monthStart } },
      }),
      // This year
      prisma.booking.count({
        where: { bookingStatus: 'confirmed_booking', date: { gte: yearStart } },
      }),
      prisma.user.count({ where: { role: 'user' } }),
      // Pending payment slips awaiting admin confirmation
      prisma.booking.count({
        where: { paymentStatus: 'submitted', bookingStatus: 'confirmed_booking' },
      }),
      prisma.booking.aggregate({
        where: {
          date: { gte: today, lt: tomorrow },
          paymentStatus: { in: ['submitted', 'confirmed'] },
          bookingStatus: 'confirmed_booking',
        },
        _sum: { totalPrice: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        todayBookings,
        totalBookings,
        bookingsByPeriod: {
          today: todayBookings,
          week: bookingsThisWeek,
          month: bookingsThisMonth,
          year: bookingsThisYear,
        },
        totalUsers,
        pendingPayments,
        todayRevenue: todayRevenue._sum.totalPrice || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/dashboard/today-bookings
// @desc    Get today's confirmed bookings for the dashboard table
// @access  Admin
router.get('/dashboard/today-bookings', protect, adminAccess, async (req, res) => {
  try {
    await autoCompletePassedBookings();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        date: { gte: today, lt: tomorrow },
        status: { not: 'cancelled' },
        bookingStatus: 'confirmed_booking',
      },
      include: {
        user: { select: { name: true, phone: true } },
        court: { select: { courtNumber: true, name: true } },
        coach: { select: { name: true, nickname: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// BOOKING MANAGEMENT
// ============================================================

// @route   GET /api/admin/bookings
// @desc    Get all CONFIRMED bookings with filters (paginated).
//          Provisional-only (unpaid draft) bookings are excluded.
//          Fixes: search param, court filter key, period filter.
// @access  Admin
router.get('/bookings', protect, adminAccess, async (req, res) => {
  try {
    await autoCompletePassedBookings();

    const { page = 1, limit = 20, status, paymentStatus, date, period, court, courtId: courtIdParam, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Only show bookings that have gone through the payment flow
    const where = { bookingStatus: 'confirmed_booking' };

    if (status)        where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    // Accept both 'court' (frontend key) and 'courtId' (legacy)
    const resolvedCourtId = courtIdParam || court;
    if (resolvedCourtId) where.courtId = resolvedCourtId;

    // Period filter takes priority over a specific date
    if (period) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      switch (period) {
        case 'today':
          where.date = { gte: today, lt: tomorrow };
          break;
        case 'week': {
          const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
          where.date = { gte: weekStart };
          break;
        }
        case 'month':
          where.date = { gte: new Date(today.getFullYear(), today.getMonth(), 1) };
          break;
        case 'year':
          where.date = { gte: new Date(today.getFullYear(), 0, 1) };
          break;
        default:
          break;
      }
    } else if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: d, lt: nextDay };
    }

    // Text search across booking ID, user name, user phone
    if (search) {
      where.OR = [
        { bookingId: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [results, total] = await prisma.$transaction([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { name: true, phone: true, email: true } },
          court: { select: { courtNumber: true, name: true } },
          coach: { select: { name: true, nickname: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      success: true,
      data: results,
      pagination: { current: parseInt(page), pages: Math.ceil(total / parseInt(limit)), total },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/bookings/:id/confirm-payment
// @desc    Admin confirms payment for a booking
// @access  Admin
router.put('/bookings/:id/confirm-payment', protect, adminAccess, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const updateData = { paymentStatus: 'confirmed' };

    // When confirming additional payment after a coach upgrade, merge the amount into totalPrice
    if (booking.additionalAmountDue > 0) {
      updateData.totalPrice = booking.totalPrice + booking.additionalAmountDue;
      updateData.additionalAmountDue = 0;
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ success: true, message: 'Payment confirmed', data: updatedBooking });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/bookings/:id/status
// @desc    Update booking status — admin cancel only (auto-complete handles completion)
// @access  Admin
router.put('/bookings/:id/status', protect, adminAccess, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Admin can only cancel bookings.' });
    }

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking already cancelled' });
    }

    // Determine refund based on current payment state
    let creditRefund = 0;
    let newPaymentStatus = 'refunded';

    if (booking.paymentStatus === 'pending') {
      creditRefund = booking.creditUsed;
      newPaymentStatus = 'refunded';
    } else if (booking.paymentStatus === 'submitted') {
      creditRefund = 0;
      newPaymentStatus = 'pending_refund';
    } else if (booking.paymentStatus === 'confirmed') {
      creditRefund = booking.totalPrice + booking.creditUsed;
      newPaymentStatus = 'refunded';
    }

    const ops = [
      prisma.booking.update({
        where: { id: req.params.id },
        data: {
          status: 'cancelled',
          paymentStatus: newPaymentStatus,
          cancelledAt: new Date(),
        },
      }),
    ];

    if (creditRefund > 0) {
      ops.push(
        prisma.user.update({
          where: { id: booking.userId },
          data: { credit: { increment: creditRefund } },
        })
      );
    }

    const [updatedBooking] = await prisma.$transaction(ops);

    // Notify clients watching this court+date that the slot is free again
    const dateKey = booking.date.toISOString().slice(0, 10);
    getIO().to(`court:${booking.courtId}:${dateKey}`).emit('slot:cancelled', {
      courtId: booking.courtId,
      date: dateKey,
      startTime: booking.startTime,
      endTime: booking.endTime,
      userId: req.user.id,
    });

    return res.json({
      success: true,
      message: creditRefund > 0
        ? `Booking cancelled. ฿${creditRefund} refunded as credits to user account.`
        : newPaymentStatus === 'pending_refund'
          ? 'Booking cancelled. Payment slip was submitted — process refund to return funds to user.'
          : 'Booking cancelled.',
      data: updatedBooking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// USER MANAGEMENT
// ============================================================

// @route   GET /api/admin/users
// @desc    Get all users (paginated, searchable)
// @access  Admin
router.get('/users', protect, adminAccess, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { current: parseInt(page), pages: Math.ceil(total / parseInt(limit)), total },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (role, credit, isActive)
// @access  Admin
router.put('/users/:id', protect, adminAccess, async (req, res) => {
  try {
    const { role, credit, isActive } = req.body;
    const data = {};

    if (role !== undefined) {
      if (req.user.role !== 'master_admin') {
        return res.status(403).json({ success: false, message: 'Only master admin can change roles' });
      }
      data.role = role;
    }

    if (credit !== undefined)   data.credit = Number(credit);
    if (isActive !== undefined) data.isActive = isActive;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ success: true, data: user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// BUSINESS SUMMARY — Master Admin only
// ============================================================

// @route   GET /api/admin/business-summary
// @desc    Revenue, bookings, courts, coaches, top customers
// @access  Master Admin
router.get('/business-summary', protect, masterOnly, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // 1. Revenue total — only confirmed bookings
    const revenueData = await prisma.booking.aggregate({
      where: {
        createdAt: { gte: startDate },
        paymentStatus: { in: ['submitted', 'confirmed'] },
        bookingStatus: 'confirmed_booking',
      },
      _sum: { totalPrice: true },
      _count: { id: true },
    });

    // 2. Bookings by status — confirmed bookings only
    const bookingsByStatusRaw = await prisma.booking.groupBy({
      by: ['status'],
      where: { createdAt: { gte: startDate }, bookingStatus: 'confirmed_booking' },
      _count: { status: true },
    });
    const bookingsByStatus = bookingsByStatusRaw.reduce((acc, curr) => {
      acc[curr.status] = curr._count.status;
      return acc;
    }, {});

    // 3. Court utilization
    const courtGroups = await prisma.booking.groupBy({
      by: ['courtId'],
      where: {
        createdAt: { gte: startDate },
        status: { not: 'cancelled' },
        bookingStatus: 'confirmed_booking',
      },
      _sum: { duration: true },
      _count: { courtId: true },
    });
    const courtIds = courtGroups.map(g => g.courtId);
    const courts = await prisma.court.findMany({ where: { id: { in: courtIds } } });
    const courtUtilization = courtGroups.map(g => {
      const court = courts.find(c => c.id === g.courtId);
      return {
        courtNumber: court?.courtNumber,
        name: court?.name,
        totalHours: g._sum.duration || 0,
        bookings: g._count.courtId,
      };
    });

    // 4. Coach revenue
    const coachGroups = await prisma.booking.groupBy({
      by: ['coachId'],
      where: {
        createdAt: { gte: startDate },
        coachId: { not: null },
        status: { not: 'cancelled' },
        bookingStatus: 'confirmed_booking',
      },
      _sum: { coachPrice: true },
      _count: { coachId: true },
    });
    const coachIds = coachGroups.map(g => g.coachId).filter(Boolean);
    const coachList = await prisma.coach.findMany({ where: { id: { in: coachIds } } });
    const coachRevenue = coachGroups.map(g => {
      const coach = coachList.find(c => c.id === g.coachId);
      return {
        name: coach?.name,
        revenue: g._sum.coachPrice || 0,
        sessions: g._count.coachId,
      };
    });

    // 5. New users
    const newUsers = await prisma.user.count({
      where: { createdAt: { gte: startDate }, role: 'user' },
    });

    // 6. Top customers
    const customerGroups = await prisma.booking.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startDate },
        status: { not: 'cancelled' },
        bookingStatus: 'confirmed_booking',
      },
      _sum: { totalPrice: true },
      _count: { userId: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });
    const userIds = customerGroups.map(g => g.userId);
    const userList = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, phone: true },
    });
    const topCustomers = customerGroups.map(g => {
      const user = userList.find(u => u.id === g.userId);
      return {
        name: user?.name,
        phone: user?.phone,
        totalSpent: g._sum.totalPrice || 0,
        bookings: g._count.userId,
      };
    });

    // 7. Daily revenue — raw SQL for date-level grouping
    const dailyRevenueRaw = await prisma.$queryRaw`
      SELECT
        DATE("date") AS day,
        SUM("totalPrice")::float AS revenue,
        COUNT(*)::int AS bookings
      FROM "Booking"
      WHERE "createdAt" >= ${startDate}
        AND "paymentStatus" IN ('submitted', 'confirmed')
        AND "bookingStatus" = 'confirmed_booking'
      GROUP BY DATE("date")
      ORDER BY day ASC
    `;

    // Normalize the day field to an ISO date string for the frontend
    const dailyRevenue = dailyRevenueRaw.map(r => ({
      date: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
      revenue: Number(r.revenue) || 0,
      bookings: Number(r.bookings) || 0,
    }));

    res.json({
      success: true,
      data: {
        period,
        totalRevenue: revenueData._sum.totalPrice || 0,
        totalBookings: revenueData._count.id || 0,
        bookingsByStatus,
        courtUtilization,
        coachRevenue,
        newUsers,
        topCustomers,
        dailyRevenue,
      },
    });
  } catch (error) {
    console.error('Business summary error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/admin/bookings/:id/reassign-coach
// @desc    Admin reassigns (or removes) the coach on an upcoming booking
// @access  Admin
router.put('/bookings/:id/reassign-coach', protect, adminAccess, async (req, res) => {
  try {
    const { coachOption, coachId, outsideCoachName } = req.body;

    if (!['none', 'in_house', 'outside'].includes(coachOption)) {
      return res.status(400).json({ success: false, message: 'Invalid coachOption' });
    }

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== 'upcoming') {
      return res.status(400).json({ success: false, message: 'Can only reassign coach on upcoming bookings' });
    }
    if (booking.paymentStatus === 'submitted' || booking.paymentStatus === 'pending_refund') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reassign coach while payment is being processed. Confirm or refund payment first.',
      });
    }
    if (booking.additionalAmountDue > 0) {
      return res.status(400).json({
        success: false,
        message: 'A previous coach change payment is still pending. Confirm that payment before reassigning again.',
      });
    }

    let newCoachPrice = 0;
    let newCoachId = null;
    let newOutsideCoachName = '';

    if (coachOption === 'in_house') {
      if (!coachId) return res.status(400).json({ success: false, message: 'coachId required for in_house option' });
      const coach = await prisma.coach.findUnique({ where: { id: coachId } });
      if (!coach || !coach.isActive) {
        return res.status(404).json({ success: false, message: 'Coach not found or inactive' });
      }
      newCoachPrice = coach.pricePerHour * booking.duration;
      newCoachId = coach.id;
    } else if (coachOption === 'outside') {
      const feeSetting = await prisma.setting.findUnique({ where: { key: 'outside_coach_fee' } });
      newCoachPrice = feeSetting ? Number(feeSetting.value) : 100;
      newOutsideCoachName = outsideCoachName || '';
    }

    const originalCoachPrice = booking.coachPrice;
    const difference = newCoachPrice - originalCoachPrice;
    const newSubtotal = booking.courtPrice + newCoachPrice + booking.addOnsTotal;
    const newCoachStatus = coachOption === 'none' ? 'cancelled' : 'changed';

    const updateData = {
      coachOption,
      coachId: newCoachId,
      outsideCoachName: newOutsideCoachName,
      coachPrice: newCoachPrice,
      subtotal: newSubtotal,
      coachStatus: newCoachStatus,
    };

    const ops = [prisma.booking.update({ where: { id: req.params.id }, data: updateData })];
    let responseMessage = '';

    if (booking.paymentStatus === 'confirmed') {
      if (difference > 0) {
        ops[0] = prisma.booking.update({
          where: { id: req.params.id },
          data: { ...updateData, additionalAmountDue: difference, paymentStatus: 'pending' },
        });
        responseMessage = `Coach reassigned. User must pay an additional ฿${difference}.`;
      } else if (difference < 0) {
        const refundAmount = Math.abs(difference);
        ops[0] = prisma.booking.update({
          where: { id: req.params.id },
          data: { ...updateData, totalPrice: booking.totalPrice + difference, additionalAmountDue: 0 },
        });
        ops.push(
          prisma.user.update({
            where: { id: booking.userId },
            data: { credit: { increment: refundAmount } },
          })
        );
        responseMessage = `Coach reassigned. ฿${refundAmount} refunded to user's credit balance.`;
      } else {
        responseMessage = 'Coach reassigned. No price difference.';
      }
    } else {
      ops[0] = prisma.booking.update({
        where: { id: req.params.id },
        data: {
          ...updateData,
          totalPrice: newSubtotal - booking.creditUsed,
          additionalAmountDue: 0,
        },
      });
      responseMessage = 'Coach reassigned. Prices updated.';
    }

    const results = await prisma.$transaction(ops);
    const updatedBooking = results[0];

    res.json({
      success: true,
      message: responseMessage,
      data: {
        bookingId: updatedBooking.bookingId,
        coachOption: updatedBooking.coachOption,
        coachPrice: updatedBooking.coachPrice,
        coachStatus: updatedBooking.coachStatus,
        additionalAmountDue: updatedBooking.additionalAmountDue,
        paymentStatus: updatedBooking.paymentStatus,
        totalPrice: updatedBooking.totalPrice,
      },
    });
  } catch (error) {
    console.error('Reassign coach error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/admin/bookings/:id/process-refund
// @desc    Admin processes a pending cash refund — returns funds as credits to user
// @access  Admin
router.put('/bookings/:id/process-refund', protect, adminAccess, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'cancelled' || booking.paymentStatus !== 'pending_refund') {
      return res.status(400).json({
        success: false,
        message: 'This booking is not eligible for refund processing. It must be cancelled with a pending refund.',
      });
    }

    const refundAmount = booking.totalPrice + booking.creditUsed;

    const [updatedBooking, updatedUser] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: req.params.id },
        data: { paymentStatus: 'refunded' },
      }),
      prisma.user.update({
        where: { id: booking.userId },
        data: { credit: { increment: refundAmount } },
      }),
    ]);

    res.json({
      success: true,
      message: `Refund of ฿${refundAmount} processed. Credits added to user's account.`,
      data: {
        bookingId: updatedBooking.bookingId,
        refundAmount,
        newUserCredit: updatedUser.credit,
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
