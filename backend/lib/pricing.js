// Pricing helpers — time-band (peak) pricing for courts and coaches.
//
// Rules are rows shaped { dayOfWeek, startTime: "HH:mm", endTime: "HH:mm", pricePerHour }.
//   • Courts: CourtPricing rows (pricePerHour required).
//   • Coaches: CoachAvailability rows double as pricing rules (pricePerHour nullable —
//     null means the coach's base rate applies inside that window).
//
// An hourly slot [H:00, H+1:00) takes a rule's price only when the rule fully
// covers the hour on that dayOfWeek. Hours no rule covers fall back to the base
// per-hour price. Bookings are priced hour-by-hour, so a booking that straddles
// a peak boundary charges each hour at its own rate.

const pad = (h) => `${String(h).padStart(2, '0')}:00`;

const rateForHour = (rules, basePricePerHour, dayOfWeek, hour) => {
  const slotStart = pad(hour);
  const slotEnd = pad(hour + 1);
  const rule = (rules || []).find(r =>
    r.dayOfWeek === dayOfWeek &&
    r.startTime <= slotStart &&
    r.endTime >= slotEnd &&
    r.pricePerHour != null
  );
  return rule ? rule.pricePerHour : basePricePerHour;
};

// Sum over whole hours in [startTime, endTime). Times are "HH:mm" on the hour.
const priceForRange = (rules, basePricePerHour, dayOfWeek, startTime, endTime) => {
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);
  let total = 0;
  for (let h = startHour; h < endHour; h++) {
    total += rateForHour(rules, basePricePerHour, dayOfWeek, h);
  }
  return total;
};

// dayOfWeek (0=Sun…6=Sat) of a "YYYY-MM-DD" calendar date, timezone-safe.
const dayOfWeekOf = (dateStr) => new Date(dateStr + 'T12:00:00Z').getUTCDay();

module.exports = { rateForHour, priceForRange, dayOfWeekOf };
