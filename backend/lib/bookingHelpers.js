// Shared booking helper utilities
// Imported by both routes/bookings.js and routes/admin.js
const prisma = require('./prisma');

/**
 * Mark any confirmed 'upcoming' bookings whose court date+endTime
 * has already passed as 'completed'.
 * Expired provisionals are intentionally excluded — they hold no slot and
 * are simply ignored, not completed.
 */
async function autoCompletePassedBookings() {
  const now = new Date();
  const todayUTC = new Date(now);
  todayUTC.setUTCHours(0, 0, 0, 0);
  const tomorrowUTC = new Date(todayUTC);
  tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
  // startTime/endTime are stored as court-local (Asia/Bangkok) "HH:mm" strings,
  // not UTC — using getUTCHours() here compared bookings against the wrong
  // clock, delaying auto-completion by up to 7 hours (Bangkok is UTC+7).
  const currentTimeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  await prisma.booking.updateMany({
    where: {
      status: 'upcoming',
      bookingStatus: 'confirmed_booking',
      OR: [
        { date: { lt: todayUTC } },
        {
          date: { gte: todayUTC, lt: tomorrowUTC },
          endTime: { lte: currentTimeStr },
        },
      ],
    },
    data: { status: 'completed' },
  });
}

// Human-readable booking ref (BK-XXXXXX) — charset avoids ambiguous characters
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

module.exports = { autoCompletePassedBookings, generateBookingId };
