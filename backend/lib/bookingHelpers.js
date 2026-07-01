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
  const currentTimeStr = `${String(now.getUTCHours()).padStart(2, '0')}:00`;

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

module.exports = { autoCompletePassedBookings };
