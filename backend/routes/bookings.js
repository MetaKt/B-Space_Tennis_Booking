// Bookings routes — migrated from Mongoose to Prisma
//
// BOOKING FLOW (lock-at-Step-0, resume-from-Upcoming):
//   1. POST /bookings                  → draft provisional (court + date + time only)
//                                        slot is locked here, 15-min countdown starts
//                                        optional `replacePreviousId` swaps an old draft atomically
//   2. POST /bookings/:id/confirm-payment
//                                      → finalises coach + add-ons (server re-derives all prices)
//                                        provisional → confirmed_booking
//   3. POST /bookings/:id/payment-slip → user uploads payment slip
//   4. PUT  /admin/bookings/:id/confirm-payment → admin verifies payment (paymentStatus → confirmed)
//
// RACE & ABUSE PROTECTIONS:
//   • POST /bookings is wrapped in a SERIALIZABLE transaction. PostgreSQL SSI guarantees
//     two concurrent requests for the same slot cannot both succeed (P2034 aborts one).
//   • POST /:id/confirm-payment uses an atomic conditional update (updateMany with
//     bookingStatus='provisional' filter) so double-tap cannot double-deduct credit.
//   • PUT /:id/cancel uses the same atomic conditional pattern to prevent double refund.
//   • Add-on prices are NEVER trusted from the client — looked up server-side from Settings.
//   • Max 1 active provisional per user enforced (excluding the one being replaced via swap).

const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { protect, adminAccess } = require('../middleware/auth');
const { getIO } = require('../lib/socket');
const { getUploader, getFilePath, FILTERS } = require('../lib/storage');

const router = express.Router();

// Payment slip upload — 10 MB limit, images + PDF
const upload = getUploader('payments', {
  prefix: 'payment',
  fileFilter: FILTERS.imagesPdf,
});

// Helper: mark any 'upcoming' bookings whose date+endTime has passed as 'completed'
async function autoCompletePassedBookings() {
  const now = new Date();
  const todayUTC = new Date(now);
  todayUTC.setUTCHours(0, 0, 0, 0);
  const tomorrowUTC = new Date(todayUTC);
  tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
  const currentTimeStr = `${String(now.getUTCHours()).padStart(2, '0')}:00`;

  await prisma.booking.updateMany({
    where: {
      status: 'upcoming',
      bookingStatus: 'confirmed_booking', // expired provisionals are NOT completed; they're just ignored
      OR: [
        { date: { lt: todayUTC } },
        { date: { gte: todayUTC, lt: tomorrowUTC }, endTime: { lte: currentTimeStr } },
      ],
    },
    data: { status: 'completed' },
  });
}

// Helper: generate human-readable booking ID (BK-XXXXXX)
const BOOKING_ID_CHARSET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';
async function generateBookingId() {
  let id, exists = true;
  while (exists) {
    const suffix = Array.from({ length: 6 }, () =>
      BOOKING_ID_CHARSET[Math.floor(Math.random() * BOOKING_ID_CHARSET.length)]
    ).join('');
    id = `BK-${suffix}`;
    exists = !!(await prisma.booking.findUnique({ where: { bookingId: id } }));
  }
  return id;
}

// Helper: resolve add-on prices from the Settings table.
// Input from client: [{ name, quantity }]  — prices are IGNORED if sent.
// Output: { items: [{ name, price, quantity }], total } — server-derived pricing.
//
// Add-ons are stored as individual Setting rows under category='add_ons',
// each with value = { name, price, available }. We build a name→price map
// (case-insensitive) and drop any client-sent item that isn't in the catalog.
async function resolveAddOnPricing(clientAddOns) {
  if (!Array.isArray(clientAddOns) || clientAddOns.length === 0) {
    return { items: [], total: 0 };
  }
  const settings = await prisma.setting.findMany({ where: { category: 'add_ons' } });
  const lookup = new Map();
  for (const s of settings) {
    const v = s.value;
    if (v && typeof v === 'object' && v.name && v.available !== false && typeof v.price === 'number') {
      lookup.set(String(v.name).trim().toLowerCase(), { name: v.name, price: v.price });
    }
  }
  const items = [];
  let total = 0;
  for (const ao of clientAddOns) {
    if (!ao || !ao.name) continue;
    const key = String(ao.name).trim().toLowerCase();
    const entry = lookup.get(key);
    if (!entry) continue; // unknown add-on — silently drop (defends against fake names)
    const qty = Math.max(1, parseInt(ao.quantity) || 1);
    items.push({ name: entry.name, price: entry.price, quantity: qty });
    total += entry.price * qty;
  }
  return { items, total };
}

// =========================================================================
// GET /api/bookings/available-slots
// =========================================================================
router.get('/available-slots', protect, async (req, res) => {
  try {
    const { date, courtId } = req.query;
    if (!date || !courtId) {
      return res.status(400).json({ success: false, message: 'Date and court ID are required' });
    }

    const court = await prisma.court.findUnique({ where: { id: courtId } });
    if (!court || !court.isActive) {
      return res.status(404).json({ success: false, message: 'Court not found or inactive' });
    }

    const queryDate = new Date(date + 'T00:00:00Z');
    const nextDay = new Date(queryDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const existingBookings = await prisma.booking.findMany({
      where: {
        courtId,
        date: { gte: queryDate, lt: nextDay },
        status: { not: 'cancelled' },
        OR: [
          { bookingStatus: 'confirmed_booking' },
          { bookingStatus: 'provisional', expiresAt: { gt: new Date() } },
        ],
      },
      select: { startTime: true, endTime: true },
    });

    const openHour = parseInt(court.openTime.split(':')[0]);
    const closeHour = parseInt(court.closeTime.split(':')[0]);
    const slots = [];

    for (let hour = openHour; hour < closeHour; hour++) {
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
      const endStr = `${(hour + 1).toString().padStart(2, '0')}:00`;
      const isBooked = existingBookings.some(b => {
        const bStart = parseInt(b.startTime.split(':')[0]);
        const bEnd = parseInt(b.endTime.split(':')[0]);
        return hour >= bStart && hour < bEnd;
      });
      slots.push({ startTime: timeStr, endTime: endStr, available: !isBooked, price: court.pricePerHour });
    }

    res.json({ success: true, data: { court, slots } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// =========================================================================
// GET /api/bookings/available-coaches
// =========================================================================
router.get('/available-coaches', protect, async (req, res) => {
  try {
    const { date, startTime, endTime } = req.query;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Date, start time and end time are required' });
    }

    const queryDate = new Date(date + 'T00:00:00Z');
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();

    const coaches = await prisma.coach.findMany({
      where: { isActive: true, isInHouse: true },
      include: { availability: true },
    });

    const nextDay = new Date(queryDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const coachBookings = await prisma.booking.findMany({
      where: {
        date: { gte: queryDate, lt: nextDay },
        coachId: { not: null },
        status: { not: 'cancelled' },
      },
      select: { coachId: true, startTime: true, endTime: true },
    });

    const availableCoaches = coaches.filter(coach => {
      const hasSchedule = coach.availability.length === 0 || coach.availability.some(a =>
        a.dayOfWeek === dayOfWeek && a.startTime <= startTime && a.endTime >= endTime
      );
      if (!hasSchedule && coach.availability.length > 0) return false;

      const isBooked = coachBookings.some(b => {
        if (b.coachId !== coach.id) return false;
        const bStart = parseInt(b.startTime.split(':')[0]);
        const bEnd = parseInt(b.endTime.split(':')[0]);
        const rStart = parseInt(startTime.split(':')[0]);
        const rEnd = parseInt(endTime.split(':')[0]);
        return rStart < bEnd && rEnd > bStart;
      });
      return !isBooked;
    });

    res.json({ success: true, data: availableCoaches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// =========================================================================
// POST /api/bookings
// Creates a DRAFT provisional booking (court + date + time only).
// Coach and add-ons come later at confirm-payment.
// Optional `replacePreviousId` lets the user atomically swap their existing
// provisional for a new one — used when they re-select date/court/time on Step 0.
// =========================================================================
router.post('/', protect, async (req, res) => {
  try {
    const { courtId, date, startTime, endTime, duration, replacePreviousId } = req.body;

    if (!courtId || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'courtId, date, startTime, endTime are required' });
    }

    // Validate court
    const court = await prisma.court.findUnique({ where: { id: courtId } });
    if (!court || !court.isActive) {
      return res.status(404).json({ success: false, message: 'Court not found or inactive' });
    }

    const queryDate = new Date(date + 'T00:00:00Z');
    const nextDay = new Date(queryDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const hours = duration || (parseInt(endTime.split(':')[0]) - parseInt(startTime.split(':')[0]));

    // Enforce max booking hours
    const maxHoursSetting = await prisma.setting.findUnique({ where: { key: 'max_booking_hours' } });
    const maxBookingHours = maxHoursSetting ? Number(maxHoursSetting.value) : 4;
    if (hours <= 0 || hours > maxBookingHours) {
      return res.status(400).json({
        success: false,
        message: `Booking duration must be between 1 and ${maxBookingHours} hours`,
      });
    }

    // ----- Provisional swap support -----
    // If user is replacing an existing provisional, fetch its details FIRST so we can
    // emit slot:cancelled for the old slot after the transaction commits.
    let previousData = null;
    if (replacePreviousId) {
      previousData = await prisma.booking.findFirst({
        where: { id: replacePreviousId, userId: req.user.id },
        select: { id: true, courtId: true, date: true, startTime: true, endTime: true, bookingStatus: true, status: true, expiresAt: true },
      });
      // Only honor if it's actually a live provisional of this user
      if (!previousData
        || previousData.bookingStatus !== 'provisional'
        || previousData.status !== 'upcoming'
        || (previousData.expiresAt && previousData.expiresAt <= new Date())
      ) {
        previousData = null;
      }
    }

    // ----- Provisional cap: max 1 per user -----
    const activeCount = await prisma.booking.count({
      where: {
        userId: req.user.id,
        bookingStatus: 'provisional',
        status: 'upcoming',
        expiresAt: { gt: new Date() },
        ...(previousData ? { id: { not: previousData.id } } : {}),
      },
    });
    if (activeCount >= 1) {
      return res.status(409).json({
        success: false,
        code: 'HAS_PROVISIONAL',
        message: 'You already have a pending reservation. Please complete or cancel it before booking another slot.',
      });
    }

    // Court price snapshot — locked at provisional creation. Admin changes during
    // the 15-min window will not retroactively affect this booking.
    const courtPrice = court.pricePerHour * hours;
    const bookingId = await generateBookingId();

    // ----- Atomic swap + conflict check + create inside SERIALIZABLE transaction -----
    let booking;
    try {
      booking = await prisma.$transaction(async (tx) => {
        // Cancel previous (own, still provisional) — atomic conditional update
        if (previousData) {
          await tx.booking.updateMany({
            where: {
              id: previousData.id,
              userId: req.user.id,
              bookingStatus: 'provisional',
              status: 'upcoming',
            },
            data: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancellationReason: 'replaced_by_swap',
              paymentStatus: 'refunded', // no money/credit was ever applied to a draft provisional
            },
          });
        }

        // Conflict check
        const conflict = await tx.booking.findFirst({
          where: {
            courtId,
            status: { not: 'cancelled' },
            date: { gte: queryDate, lt: nextDay },
            OR: [
              { bookingStatus: 'confirmed_booking', startTime: { lt: endTime }, endTime: { gt: startTime } },
              { bookingStatus: 'provisional', expiresAt: { gt: new Date() }, startTime: { lt: endTime }, endTime: { gt: startTime } },
            ],
          },
        });

        if (conflict) {
          const err = new Error('SLOT_CONFLICT');
          err.code = 'SLOT_CONFLICT';
          throw err;
        }

        return tx.booking.create({
          data: {
            bookingId,
            userId: req.user.id,
            courtId,
            date: queryDate,
            startTime,
            endTime,
            duration: hours,
            // Draft state — no coach, no add-ons yet
            coachOption: 'none',
            coachId: null,
            outsideCoachName: '',
            courtPrice,
            coachPrice: 0,
            addOns: [],
            addOnsTotal: 0,
            subtotal: courtPrice,
            creditUsed: 0,
            totalPrice: courtPrice,
            paymentStatus: 'pending',
            status: 'upcoming',
            bookingStatus: 'provisional',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15-min lock
          },
          include: {
            court: { select: { courtNumber: true, name: true } },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (txError) {
      if (txError.code === 'SLOT_CONFLICT' || txError.code === 'P2034') {
        return res.status(409).json({
          success: false,
          code: 'SLOT_TAKEN',
          message: 'This time slot was just booked by another user. Please pick a different slot.',
        });
      }
      throw txError;
    }

    // ----- Socket emits (after commit) -----
    // 1) Free the old slot if we swapped
    if (previousData) {
      const prevDateKey = previousData.date.toISOString().slice(0, 10);
      getIO().to(`court:${previousData.courtId}:${prevDateKey}`).emit('slot:cancelled', {
        courtId: previousData.courtId,
        date: prevDateKey,
        startTime: previousData.startTime,
        endTime: previousData.endTime,
        userId: req.user.id,
      });
    }
    // 2) Mark the new slot as booked
    const dateKey = booking.date.toISOString().slice(0, 10);
    getIO().to(`court:${courtId}:${dateKey}`).emit('slot:booked', {
      courtId,
      date: dateKey,
      startTime: booking.startTime,
      endTime: booking.endTime,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Slot reserved successfully',
      data: booking,
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// =========================================================================
// POST /api/bookings/:id/confirm-payment
// Finalises coach + add-ons + credit on a provisional booking.
// Server re-derives ALL prices from the database — client-supplied prices are ignored.
// Uses an atomic conditional update to prevent double-tap race (loophole #2).
// =========================================================================
router.post('/:id/confirm-payment', protect, async (req, res) => {
  try {
    const { coachOption = 'none', coachId, outsideCoachName = '', addOns = [], creditUsed = 0 } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (booking.bookingStatus !== 'provisional') {
      return res.status(409).json({ success: false, message: 'Booking is no longer in a reservable state' });
    }
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      return res.status(409).json({ success: false, message: 'Booking session has expired' });
    }

    // ----- Server-side coach pricing -----
    let resolvedCoachOption = 'none';
    let resolvedCoachId = null;
    let resolvedOutsideCoachName = '';
    let coachPrice = 0;

    if (coachOption === 'in_house' && coachId) {
      const coach = await prisma.coach.findUnique({ where: { id: coachId } });
      if (!coach || !coach.isActive) {
        return res.status(400).json({ success: false, message: 'Selected coach is unavailable' });
      }
      resolvedCoachOption = 'in_house';
      resolvedCoachId = coach.id;
      coachPrice = coach.pricePerHour * booking.duration;
    } else if (coachOption === 'outside') {
      const feeSetting = await prisma.setting.findUnique({ where: { key: 'outside_coach_fee' } });
      resolvedCoachOption = 'outside';
      resolvedOutsideCoachName = (outsideCoachName || '').trim().slice(0, 100);
      coachPrice = feeSetting ? Number(feeSetting.value) : 100;
    }

    // ----- Server-side add-on pricing -----
    const { items: resolvedAddOns, total: addOnsTotal } = await resolveAddOnPricing(addOns);

    const subtotal = booking.courtPrice + coachPrice + addOnsTotal;

    // ----- Server-side credit cap -----
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const actualCreditUsed = creditUsed > 0
      ? Math.min(Number(creditUsed), user.credit, subtotal)
      : 0;
    const finalTotalPrice = subtotal - actualCreditUsed;

    // If credit covers everything, auto-confirm payment
    const newPaymentStatus = finalTotalPrice === 0 ? 'confirmed' : 'pending';

    // ----- ATOMIC conditional update (prevents double-tap double-debit) -----
    // updateMany with bookingStatus='provisional' filter: only succeeds if booking
    // is still provisional. Two concurrent calls = first wins, second's count===0.
    const updateResult = await prisma.booking.updateMany({
      where: {
        id: req.params.id,
        userId: req.user.id,
        bookingStatus: 'provisional',
        expiresAt: { gt: new Date() },
      },
      data: {
        coachOption: resolvedCoachOption,
        coachId: resolvedCoachId,
        outsideCoachName: resolvedOutsideCoachName,
        coachPrice,
        addOns: resolvedAddOns,
        addOnsTotal,
        subtotal,
        creditUsed: actualCreditUsed,
        totalPrice: finalTotalPrice,
        paymentStatus: newPaymentStatus,
        bookingStatus: 'confirmed_booking',
        expiresAt: null,
      },
    });

    if (updateResult.count === 0) {
      // Someone else already confirmed this booking (double-tap, or expired in the meantime)
      return res.status(409).json({
        success: false,
        message: 'Booking is no longer reservable. It may have already been confirmed or expired.',
      });
    }

    // Decrement credit (itself atomic via Prisma's `decrement`)
    if (actualCreditUsed > 0) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { credit: { decrement: actualCreditUsed } },
      });
    }

    const updatedBooking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        court: { select: { courtNumber: true, name: true } },
        coach: { select: { name: true, nickname: true, pricePerHour: true } },
      },
    });

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      data: updatedBooking,
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// =========================================================================
// POST /api/bookings/:id/payment-slip
// =========================================================================
router.post('/:id/payment-slip', protect, upload.single('paymentSlip'), async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isOwner = booking.userId === req.user.id;
    const isAdmin = ['admin', 'master_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized' });

    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a payment slip' });

    const updateData = {
      paymentSlip: getFilePath('payments', req.file.filename),
      paymentStatus: 'submitted',
    };

    // Legacy fallback path: if a slip arrives while booking is still provisional
    // (e.g. PendingPaymentModal in some admin flows), upgrade it to confirmed.
    if (booking.bookingStatus === 'provisional') {
      updateData.bookingStatus = 'confirmed_booking';
      updateData.expiresAt = null;
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Payment slip uploaded successfully',
      data: { bookingId: updatedBooking.bookingId, paymentStatus: updatedBooking.paymentStatus },
    });
  } catch (error) {
    console.error('Payment slip upload error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// =========================================================================
// GET /api/bookings/upcoming
// Returns confirmed bookings + NON-EXPIRED provisionals only.
// Expired provisionals are hidden from this view (they no longer hold a slot).
// =========================================================================
router.get('/upcoming', protect, async (req, res) => {
  try {
    await autoCompletePassedBookings();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const now = new Date();

    const bookings = await prisma.booking.findMany({
      where: {
        userId: req.user.id,
        status: 'upcoming',
        date: { gte: today },
        OR: [
          { bookingStatus: 'confirmed_booking' },
          { bookingStatus: 'provisional', expiresAt: { gt: now } },
        ],
      },
      include: {
        court: { select: { courtNumber: true, name: true, surface: true } },
        coach: { select: { name: true, nickname: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =========================================================================
// GET /api/bookings/history
// =========================================================================
router.get('/history', protect, async (req, res) => {
  try {
    await autoCompletePassedBookings();

    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // History is for COMPLETED transactions only — provisionals (active or expired)
    // are drafts, not bookings. They surface on the Upcoming list with a countdown
    // and disappear quietly on expiry/cancel/confirm.
    const where = {
      userId: req.user.id,
      bookingStatus: 'confirmed_booking',
    };
    if (status) where.status = status;

    const [bookings, total] = await prisma.$transaction([
      prisma.booking.findMany({
        where,
        include: {
          court: { select: { courtNumber: true, name: true, surface: true } },
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
      data: bookings,
      pagination: { current: parseInt(page), pages: Math.ceil(total / parseInt(limit)), total },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =========================================================================
// GET /api/bookings/:id
// =========================================================================
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        court: true,
        coach: true,
        user: { select: { name: true, phone: true, email: true } },
      },
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isOwner = booking.userId === req.user.id;
    const isAdmin = ['admin', 'master_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized' });

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =========================================================================
// PUT /api/bookings/:id/cancel
// Uses an atomic conditional update to prevent double-refund race (loophole #3).
// =========================================================================
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isOwner = booking.userId === req.user.id;
    const isAdmin = ['admin', 'master_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized' });

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking already cancelled' });
    }
    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel completed booking' });
    }
    if (booking.paymentStatus === 'pending_refund' || booking.paymentStatus === 'refunded') {
      return res.status(400).json({ success: false, message: 'Booking already cancelled or refund already in progress' });
    }

    // Determine refund based on current state
    let creditRefund = 0;
    let newPaymentStatus = 'refunded';
    let refundMessage = 'Booking cancelled.';

    if (booking.paymentStatus === 'pending') {
      if (booking.additionalAmountDue > 0) {
        creditRefund = booking.totalPrice + booking.creditUsed;
        refundMessage = `Booking cancelled. ฿${creditRefund} refunded as credits (coach upgrade difference waived).`;
      } else {
        creditRefund = booking.creditUsed;
        refundMessage = creditRefund > 0
          ? `Booking cancelled. ฿${creditRefund} in credits returned to your account.`
          : 'Booking cancelled.';
      }
    } else if (booking.paymentStatus === 'submitted') {
      creditRefund = 0;
      newPaymentStatus = 'pending_refund';
      refundMessage = 'Booking cancelled. Your payment is pending verification. A full refund will be issued as credits once our team has processed it.';
    } else if (booking.paymentStatus === 'confirmed') {
      creditRefund = booking.totalPrice + booking.creditUsed;
      refundMessage = `Booking cancelled. ฿${creditRefund} refunded as credits to your account.`;
    }

    // ----- ATOMIC conditional cancel (prevents double-refund race) -----
    // updateMany succeeds only if booking is still in a cancellable state.
    // Two concurrent cancel requests: first wins, second sees count===0.
    const cancelResult = await prisma.booking.updateMany({
      where: {
        id: req.params.id,
        status: { notIn: ['cancelled', 'completed'] },
        paymentStatus: { notIn: ['pending_refund', 'refunded'] },
      },
      data: {
        status: 'cancelled',
        paymentStatus: newPaymentStatus,
        cancelledAt: new Date(),
        cancellationReason: req.body.reason || '',
      },
    });

    if (cancelResult.count === 0) {
      // Lost the race or state changed between read and write
      return res.status(409).json({
        success: false,
        message: 'Booking is no longer cancellable — it may have already been cancelled.',
      });
    }

    // Credit refund is itself atomic via Prisma's `increment`. Safe to run unconditionally
    // because cancelResult.count===1 means WE are the one transaction that flipped status.
    if (creditRefund > 0) {
      await prisma.user.update({
        where: { id: booking.userId },
        data: { credit: { increment: creditRefund } },
      });
    }

    // Free the slot for other users
    const dateKey = booking.date.toISOString().slice(0, 10);
    getIO().to(`court:${booking.courtId}:${dateKey}`).emit('slot:cancelled', {
      courtId: booking.courtId,
      date: dateKey,
      startTime: booking.startTime,
      endTime: booking.endTime,
      userId: req.user.id,
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: booking.userId },
      select: { credit: true },
    });

    res.json({
      success: true,
      message: refundMessage,
      data: {
        bookingId: booking.bookingId,
        paymentStatus: newPaymentStatus,
        creditRefunded: creditRefund,
        totalCredit: updatedUser.credit,
      },
    });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
