import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { format, addDays } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { courtAPI, bookingAPI, settingsAPI } from '../../utils/api';
import CourtSelector from '../../components/user/CourtSelector';

const PAYMENT_QR_IMAGE = '/QR_Code.png';
const DOWNLOAD_QR_IMAGE = '/QR_Code_FULL.jpg';

const STEPS = ['select', 'confirm', 'payment'];

// ============================================================================
// BOOKING FLOW PAGE — lock-at-Step-0 model
// ----------------------------------------------------------------------------
// • The slot is reserved (provisional booking created) the moment the user
//   clicks "Next →" on Step 0 (date + court + time selection).
// • A 15-min countdown runs from that moment, visible on Steps 1 and 2.
// • If the user changes date/court/time on Step 0 while holding a provisional,
//   they're prompted to swap (atomic cancel-old + create-new on the backend).
// • Coach + add-on choices are held in client state until "confirm-payment"
//   (Option B): backend re-derives all prices server-side (no client trust).
// • If the user navigates away (back to Home), the provisional STAYS alive
//   for the remaining time and appears on the Upcoming list with a Continue
//   CTA. Re-entry: /book?resume=<provisionalId>.
// ============================================================================

const BookingFlowPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('resume');
  const { user, updateUser } = useAuth();
  const socketRef = useSocket();
  // Auth context stores the user with the frontend's `_id` convention (MongoDB legacy),
  // but the backend returns Prisma `id` on booking records. Normalize once here so every
  // identity check uses the same value regardless of which key the user object happens to have.
  const currentUserId = user?._id || user?.id;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(!!resumeId);

  // Selection state
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [courts, setCourts] = useState([]);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Coach state (CLIENT-HELD until confirm-payment — Option B)
  const [coaches, setCoaches] = useState([]);
  const [coachOption, setCoachOption] = useState('none');
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [outsideCoachName, setOutsideCoachName] = useState('');
  const [useCredit, setUseCredit] = useState(false);
  const [settings, setSettings] = useState({});

  // Payment slip
  const [paymentSlip, setPaymentSlip] = useState(null);
  const [paymentSlipPreview, setPaymentSlipPreview] = useState('');

  // Provisional booking + countdown
  const [provisionalBooking, setProvisionalBooking] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Modals
  const [showZeroTotalModal, setShowZeroTotalModal] = useState(false);
  const [pendingSwap, setPendingSwap] = useState(null); // { reason: string } when user is about to reselect

  // ===========================================================================
  // INITIAL LOAD
  // ===========================================================================

  // Build calendar (14 days)
  useEffect(() => {
    const d = [];
    for (let i = 0; i < 14; i++) d.push(addDays(new Date(), i));
    setDates(d);
    if (!resumeId) setSelectedDate(d[0]);
    fetchCourts();
    fetchSettings();
  }, []);
  // Resume an existing provisional from /book?resume=<id>
  useEffect(() => {
    if (!resumeId) return;
    (async () => {
      try {
        const res = await bookingAPI.getById(resumeId);
        const b = res.data.data;
        if (b.userId !== currentUserId) {
          toast.error('This reservation belongs to another user.');
          navigate('/');
          return;
        }
        if (b.bookingStatus !== 'provisional') {
          toast.error('This reservation has already been confirmed or cancelled.');
          navigate('/');
          return;
        }
        if (b.expiresAt && new Date(b.expiresAt) <= new Date()) {
          toast.error('This reservation has expired.');
          navigate('/');
          return;
        }

        // Pre-populate selection state from the booking
        const courtRes = await courtAPI.getById(b.courtId);
        setSelectedCourt(courtRes.data.data);

        const dateOnly = typeof b.date === 'string' ? b.date.slice(0, 10) : format(new Date(b.date), 'yyyy-MM-dd');
        setSelectedDate(new Date(dateOnly + 'T00:00:00'));

        // Reconstruct hourly slots from startTime/endTime
        const start = parseInt(b.startTime.split(':')[0]);
        const end = parseInt(b.endTime.split(':')[0]);
        const reconstructed = [];
        for (let h = start; h < end; h++) {
          reconstructed.push({
            startTime: `${String(h).padStart(2, '0')}:00`,
            endTime: `${String(h + 1).padStart(2, '0')}:00`,
            price: courtRes.data.data.pricePerHour,
            available: true,
          });
        }
        setSelectedSlots(reconstructed);

        setProvisionalBooking(b);
        setStep(1); // jump straight into coach/add-on configuration
      } catch (err) {
        toast.error('Failed to load reservation.');
        navigate('/');
      } finally {
        setResumeLoading(false);
      }
    })();
  }, [resumeId, currentUserId]);
  // Refresh slots when date/court change (but not while resuming — we already have them)
  useEffect(() => {
    if (resumeLoading) return;
    if (selectedDate && selectedCourt) fetchSlots();
  }, [selectedDate, selectedCourt, resumeLoading]);
  // Fetch coaches when we enter Step 1 (selection is finalised)
  useEffect(() => {
    if (step === 1 && selectedSlots.length > 0 && selectedDate) {
      fetchCoaches();
    }
  }, [step]);
  const fetchCourts = async () => {
    try {
      const res = await courtAPI.getAll();
      setCourts(res.data.data);
    } catch (e) { toast.error('Failed to load courts'); }
  };

  const fetchSettings = async () => {
    try {
      const res = await settingsAPI.getPublic();
      setSettings(res.data.data);
      // add_ons feature removed — no longer loaded
    } catch (e) { /* non-fatal */ }
  };

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await bookingAPI.getAvailableSlots(dateStr, selectedCourt.id);
      setSlots(res.data.data.slots);
    } catch (e) {
      toast.error('Failed to load time slots');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoaches = async () => {
    if (selectedSlots.length === 0) return;
    try {
      const startTime = selectedSlots[0].startTime;
      const endTime = selectedSlots[selectedSlots.length - 1].endTime;
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await bookingAPI.getAvailableCoaches(dateStr, startTime, endTime);
      setCoaches(res.data.data);
    } catch (e) { /* non-fatal */ }
  };

  // ===========================================================================
  // SOCKET — real-time slot availability
  // ===========================================================================
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket || !selectedCourt || !selectedDate) return;

    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    socket.emit('join:court', { courtId: selectedCourt.id, date: dateKey });

    const markBooked = ({ startTime, endTime, userId: bookerUserId }) => {
      setSlots(prev => prev.map(s =>
        s.startTime >= startTime && s.startTime < endTime ? { ...s, available: false } : s
      ));
      // Don't clear OUR OWN selection (our provisional creation triggers this event)
      if (bookerUserId && currentUserId && bookerUserId === currentUserId) return;
      setSelectedSlots(prev => prev.filter(s => s.startTime < startTime || s.startTime >= endTime));
    };

    const markAvailable = ({ startTime, endTime }) => {
      setSlots(prev => prev.map(s =>
        s.startTime >= startTime && s.startTime < endTime ? { ...s, available: true } : s
      ));
    };

    socket.on('slot:booked', markBooked);
    socket.on('slot:cancelled', markAvailable);
    return () => {
      socket.emit('leave:court', { courtId: selectedCourt.id, date: dateKey });
      socket.off('slot:booked', markBooked);
      socket.off('slot:cancelled', markAvailable);
    };
  }, [socketRef, selectedCourt, selectedDate, currentUserId]);

  // ===========================================================================
  // STEP 0 — selection interactions
  // ===========================================================================
  const handleSlotClick = (slot) => {
    if (!slot.available) return;

    // If a slot belongs to our own provisional, allow clicking to deselect (it'll be replaced on swap)
    const isOurOwnSlot = provisionalBooking
      && provisionalBooking.startTime <= slot.startTime
      && provisionalBooking.endTime > slot.startTime;

    const isSelected = selectedSlots.find(s => s.startTime === slot.startTime);
    if (isSelected) {
      setSelectedSlots(selectedSlots.filter(s => s.startTime !== slot.startTime));
      return;
    }
    const maxHours = settings.court_operations?.max_booking_hours || 4;
    if (selectedSlots.length >= maxHours) {
      toast.error(`Maximum ${maxHours} hours per booking`);
      return;
    }
    const newSlots = [...selectedSlots, slot].sort((a, b) => parseInt(a.startTime) - parseInt(b.startTime));
    let consecutive = true;
    for (let i = 1; i < newSlots.length; i++) {
      const prevEnd = parseInt(newSlots[i - 1].endTime.split(':')[0]);
      const currStart = parseInt(newSlots[i].startTime.split(':')[0]);
      if (prevEnd !== currStart) { consecutive = false; break; }
    }
    if (consecutive) setSelectedSlots(newSlots);
    else toast.error(t('booking.selectTimeSlots'));
    // mark used to avoid lint complaint
    void isOurOwnSlot;
  };

  // ===========================================================================
  // BUILDS — payload shared between create and swap
  // ===========================================================================
  const buildSelectionPayload = () => ({
    courtId: selectedCourt.id,
    date: format(selectedDate, 'yyyy-MM-dd'),
    startTime: selectedSlots[0].startTime,
    endTime: selectedSlots[selectedSlots.length - 1].endTime,
    duration: selectedSlots.length,
  });

  // True if current selection matches the existing provisional exactly
  const selectionMatchesProvisional = () => {
    if (!provisionalBooking) return false;
    if (!selectedCourt || !selectedDate || selectedSlots.length === 0) return false;
    const pDate = typeof provisionalBooking.date === 'string'
      ? provisionalBooking.date.slice(0, 10)
      : format(new Date(provisionalBooking.date), 'yyyy-MM-dd');
    return provisionalBooking.courtId === selectedCourt.id
      && pDate === format(selectedDate, 'yyyy-MM-dd')
      && provisionalBooking.startTime === selectedSlots[0].startTime
      && provisionalBooking.endTime === selectedSlots[selectedSlots.length - 1].endTime;
  };

  // ===========================================================================
  // CORE — create / swap provisional
  // ===========================================================================
  const createOrSwapProvisional = async (replacePreviousId = null) => {
    setLoading(true);
    try {
      const payload = buildSelectionPayload();
      if (replacePreviousId) payload.replacePreviousId = replacePreviousId;
      const res = await bookingAPI.create(payload);
      setProvisionalBooking(res.data.data);
      setStep(1);
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'HAS_PROVISIONAL') {
        toast.error('You already have a pending reservation. Continue or release it from the home screen.');
        navigate('/');
      } else if (code === 'SLOT_TAKEN' || err.response?.status === 409) {
        toast.error(err.response?.data?.message || 'This time slot was just taken.');
        await fetchSlots(); // refresh availability
      } else {
        toast.error(err.response?.data?.message || 'Failed to reserve slot');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 0 "Next →" — the key lock point
  const handleNext = async () => {
    if (!selectedDate || !selectedCourt || selectedSlots.length === 0) {
      return toast.error('Please select date, court, and time');
    }

    // If selection matches our existing provisional, no API call — just advance
    if (selectionMatchesProvisional()) {
      setStep(1);
      return;
    }

    // If we have a provisional and selection changed → swap (with confirm)
    if (provisionalBooking) {
      setPendingSwap({ replaceId: provisionalBooking.id });
      return;
    }

    // No provisional yet → create one
    await createOrSwapProvisional();
  };

  // ===========================================================================
  // STEP 1 — pricing (display only; server is authoritative at confirm-payment)
  // ===========================================================================
  const calculatePricing = () => {
    const hours = selectedSlots.length || provisionalBooking?.duration || 0;
    const courtPrice = selectedCourt ? selectedCourt.pricePerHour * hours : (provisionalBooking?.courtPrice || 0);
    let coachPrice = 0;
    if (coachOption === 'in_house' && selectedCoach) coachPrice = selectedCoach.pricePerHour * hours;
    const outsideCoachFee = coachOption === 'outside' ? (settings.booking_rules?.outside_coach_fee || 100) : 0;
    const addOnsTotal = 0; // add_ons feature removed
    const subtotal = courtPrice + coachPrice + outsideCoachFee + addOnsTotal;
    const creditDiscount = useCredit ? Math.min(user?.credit || 0, subtotal) : 0;
    return { courtPrice, coachPrice, outsideCoachFee, addOnsTotal, subtotal, creditDiscount, total: subtotal - creditDiscount, hours };
  };

  const handleGoToPayment = () => {
    const pricing = calculatePricing();
    if (pricing.total === 0) {
      setShowZeroTotalModal(true);
      return;
    }
    // Provisional already exists from Step 0 — just navigate
    setStep(2);
  };

  // ===========================================================================
  // STEP 2 — submit payment (provisional → confirmed)
  // ===========================================================================
  const handleSubmitPayment = async () => {
    if (!paymentSlip) return toast.error('Please upload payment slip');
    if (!provisionalBooking) {
      toast.error('Your reservation has expired. Please start over.');
      setStep(0);
      return;
    }

    setSubmitting(true);
    try {
      const pricing = calculatePricing();
      const creditToUse = useCredit ? Math.min(user?.credit || 0, pricing.subtotal) : 0;

      // Send coach HERE for the first time (Option B: client-held until now).
      await bookingAPI.confirmPayment(provisionalBooking.id, {
        coachOption,
        coachId: coachOption === 'in_house' ? selectedCoach?.id : undefined,
        outsideCoachName: coachOption === 'outside' ? outsideCoachName : '',
        addOns: [], // add_ons feature removed
        creditUsed: creditToUse,
      });

      const formData = new FormData();
      formData.append('paymentSlip', paymentSlip);
      await bookingAPI.uploadPaymentSlip(provisionalBooking.id, formData);

      if (creditToUse > 0) updateUser({ credit: (user.credit || 0) - creditToUse });
      const code = provisionalBooking.bookingId;
      setProvisionalBooking(null);
      navigate(`/booking-success/${code}`);
    } catch (err) {
      const msg = err.response?.data?.message;
      if (err.response?.status === 409) {
        toast.error(msg || 'Your reservation has expired.');
        setProvisionalBooking(null);
        setStep(0);
        setSelectedSlots([]);
      } else {
        toast.error(msg || 'Failed to process payment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleZeroTotalBooking = async () => {
    setLoading(true);
    try {
      const pricing = calculatePricing();
      const creditToUse = Math.min(user?.credit || 0, pricing.subtotal);

      await bookingAPI.confirmPayment(provisionalBooking.id, {
        coachOption,
        coachId: coachOption === 'in_house' ? selectedCoach?.id : undefined,
        outsideCoachName: coachOption === 'outside' ? outsideCoachName : '',
        addOns: [], // add_ons feature removed
        creditUsed: creditToUse,
      });

      if (creditToUse > 0) updateUser({ credit: (user.credit || 0) - creditToUse });
      setShowZeroTotalModal(false);
      const code = provisionalBooking.bookingId;
      setProvisionalBooking(null);
      navigate(`/booking-success/${code}`);
    } catch (err) {
      setShowZeroTotalModal(false);
      toast.error(err.response?.data?.message || 'Failed to confirm booking');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentSlip(file);
      setPaymentSlipPreview(URL.createObjectURL(file));
    }
  };

  // ===========================================================================
  // COUNTDOWN — visible on Step 1 AND Step 2 (slot is locked from Step 0)
  // ===========================================================================
  useEffect(() => {
    if (!provisionalBooking?.expiresAt) { setTimeRemaining(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(provisionalBooking.expiresAt).getTime() - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0) {
        toast.error('Your reservation has expired. Please book again.');
        setProvisionalBooking(null);
        setStep(0);
        setSelectedSlots([]);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [provisionalBooking]);

  const formatTimer = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ===========================================================================
  // RENDER HELPERS
  // ===========================================================================
  const pricing = calculatePricing();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const isToday = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const currentHour = new Date().getHours();

  const CountdownBanner = () => (
    provisionalBooking && timeRemaining > 0 ? (
      <div
        style={{
          background: timeRemaining < 120 ? 'var(--red-50, #fef2f2)' : 'var(--gold-50, #fff8e1)',
          color: timeRemaining < 120 ? 'var(--red-700, #b91c1c)' : 'var(--gold-800, #856404)',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
          fontSize: '14px', fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>Slot reserved for you</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTimer(timeRemaining)}</span>
      </div>
    ) : null
  );

  if (resumeLoading) {
    return (
      <div className="mobile-wrapper">
        <div className="loading-spinner" style={{ marginTop: '40vh' }}><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="mobile-wrapper">
      <div className="booking-page">
        <div className="booking-header">
          <button className="back-btn" onClick={() => step > 0 ? setStep(step - 1) : navigate('/')}>←</button>
          <h2>{step === 2 ? t('booking.pay') : step === 1 ? t('booking.confirm') : t('booking.title')}</h2>
        </div>

        <div className="step-indicator">
          {STEPS.map((_, i) => (
            <div key={i} className={`step-dot ${i === step ? 'active' : i < step ? 'completed' : ''}`} />
          ))}
        </div>

        <div className="booking-content">
          {/* Countdown visible on Steps 1 and 2 (slot is locked from end of Step 0) */}
          {step > 0 && <CountdownBanner />}

          {/* ============================ STEP 0 ============================ */}
          {step === 0 && (
            <>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>{t('booking.selectDate')}</h3>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px' }}>
                {dates.map((date, i) => (
                  <div
                    key={i}
                    className={`date-cell ${selectedDate && format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') ? 'selected' : ''} ${i === 0 ? 'today' : ''}`}
                    onClick={() => { setSelectedDate(date); setSelectedSlots([]); }}
                    style={{ minWidth: '56px', padding: '10px 6px' }}
                  >
                    <span className="day-name">{dayNames[date.getDay()]}</span>
                    <span style={{ fontWeight: 600 }}>{format(date, 'd')}</span>
                  </div>
                ))}
              </div>

              <CourtSelector
                courts={courts}
                selectedCourt={selectedCourt}
                onSelectCourt={(court) => { setSelectedCourt(court); setSelectedSlots([]); }}
              />

              {selectedCourt && (
                <>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '20px 0 12px' }}>{t('booking.selectTime')}</h3>
                  {loading ? (
                    <div className="loading-spinner"><div className="spinner" /></div>
                  ) : (
                    <div className="time-grid">
                      {slots.map((slot, i) => {
                        const isPast = isToday && parseInt(slot.startTime.split(':')[0]) < currentHour;
                        return (
                          <div
                            key={i}
                            className={`time-slot ${!slot.available || isPast ? 'booked' : ''} ${selectedSlots.find(s => s.startTime === slot.startTime) ? 'selected' : ''}`}
                            onClick={() => !isPast && handleSlotClick(slot)}
                          >
                            {slot.startTime}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {selectedSlots.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handleNext}
                  disabled={loading}
                  style={{ marginTop: '16px' }}
                >
                  {loading ? t('common.loading') : `${t('booking.next')} →`}
                </button>
              )}

              {/* Help text when user has an active provisional */}
              {provisionalBooking && !selectionMatchesProvisional() && selectedSlots.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--gold-700, #b45309)', textAlign: 'center' }}>
                  Picking a different slot will release your current reservation.
                </div>
              )}
            </>
          )}

          {/* ============================ STEP 1 ============================ */}
          {step === 1 && (
            <>
              <div className="slip-card">
                <div className="slip-header"><h3>{t('booking.confirm')}</h3></div>
                <div className="slip-row"><span className="slip-label">{t('booking.date')}</span><span className="slip-value">{format(selectedDate, 'dd MMM yyyy')}</span></div>
                <div className="slip-row"><span className="slip-label">{t('booking.courtNumber')}</span><span className="slip-value">Court {selectedCourt?.courtNumber} - {selectedCourt?.name}</span></div>
                <div className="slip-row"><span className="slip-label">{t('booking.time')}</span><span className="slip-value">{selectedSlots[0]?.startTime} - {selectedSlots[selectedSlots.length - 1]?.endTime}</span></div>
                <div className="slip-row"><span className="slip-label">{t('booking.duration')}</span><span className="slip-value">{selectedSlots.length} {selectedSlots.length > 1 ? t('booking.hours') : t('booking.hour')}</span></div>

                <div className="slip-divider" />

                <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>{t('booking.coach')}</h4>

                <select
                  className="form-input"
                  style={{ marginBottom: '8px' }}
                  value={coachOption === 'in_house' ? (selectedCoach?.id || '') : coachOption}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'none') { setCoachOption('none'); setSelectedCoach(null); }
                    else if (val === 'outside') { setCoachOption('outside'); setSelectedCoach(null); }
                    else {
                      const coach = coaches.find(c => c.id === val);
                      setCoachOption('in_house');
                      setSelectedCoach(coach || null);
                    }
                  }}
                >
                  <option value="none">{t('booking.noCoach')}</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>{coach.nickname || coach.name}</option>
                  ))}
                  <option value="outside">{t('booking.outsideCoach')} (+฿{settings.booking_rules?.outside_coach_fee || 100})</option>
                </select>

                {coachOption === 'outside' && (
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <input type="text" className="form-input" placeholder={t('booking.outsideCoachName')} value={outsideCoachName} onChange={(e) => setOutsideCoachName(e.target.value)} />
                  </div>
                )}

                {coachOption === 'in_house' && selectedCoach && (
                  <div style={{ padding: '8px 12px', background: 'var(--gray-50)', borderRadius: '8px', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>
                    {[selectedCoach.specialization?.join(', '), `฿${selectedCoach.pricePerHour}/hr`].filter(Boolean).join(' · ')}
                  </div>
                )}

                <div className="slip-divider" />

                <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>{t('booking.pricing')}</h4>
                <div className="slip-row"><span className="slip-label">{t('booking.courtFee')}</span><span className="slip-value">฿{pricing.courtPrice.toLocaleString()}</span></div>
                {pricing.coachPrice > 0 && <div className="slip-row"><span className="slip-label">{t('booking.coachFee')}</span><span className="slip-value">฿{pricing.coachPrice.toLocaleString()}</span></div>}
                {pricing.outsideCoachFee > 0 && <div className="slip-row"><span className="slip-label">{t('booking.outsideCoachFee')}</span><span className="slip-value">฿{pricing.outsideCoachFee.toLocaleString()}</span></div>}

                {(user?.credit || 0) > 0 && (
                  <div className="slip-row" style={{ marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                      <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
                      {t('booking.useCredit')} (฿{user.credit.toLocaleString()})
                    </label>
                    {useCredit && <span className="slip-value" style={{ color: 'var(--red-500)' }}>-฿{pricing.creditDiscount.toLocaleString()}</span>}
                  </div>
                )}

                <div className="slip-divider" />
                <div className="slip-row slip-total">
                  <span className="slip-label" style={{ fontWeight: 600, fontSize: '16px' }}>{t('booking.total')}</span>
                  <span className="slip-value">฿{pricing.total.toLocaleString()}</span>
                </div>
              </div>

              <button className="btn btn-gold" onClick={handleGoToPayment} disabled={loading} style={{ marginTop: '20px' }}>
                {loading ? t('common.loading') : pricing.total === 0
                  ? `${t('booking.confirm')} (Credits Cover Full Amount)`
                  : `${t('booking.pay')} ฿${pricing.total.toLocaleString()}`}
              </button>
            </>
          )}

          {/* ============================ STEP 2 ============================ */}
          {step === 2 && (
            <>
              <div className="slip-card">
                <div className="slip-header"><h3>{t('booking.pricing')}</h3></div>
                <div className="slip-row"><span className="slip-label">{t('booking.date')}</span><span className="slip-value">{selectedDate ? format(selectedDate, 'dd MMM yyyy') : ''}</span></div>
                <div className="slip-row"><span className="slip-label">{t('booking.court')}</span><span className="slip-value">Court {selectedCourt?.courtNumber} - {selectedCourt?.name}</span></div>
                <div className="slip-row"><span className="slip-label">{t('booking.time')}</span><span className="slip-value">{selectedSlots[0]?.startTime} - {selectedSlots[selectedSlots.length - 1]?.endTime}</span></div>

                <div className="slip-divider" />
                <div className="slip-row"><span className="slip-label">{t('booking.courtFee')}</span><span className="slip-value">฿{pricing.courtPrice.toLocaleString()}</span></div>
                {pricing.coachPrice > 0 && <div className="slip-row"><span className="slip-label">{t('booking.coachFee')}</span><span className="slip-value">฿{pricing.coachPrice.toLocaleString()}</span></div>}
                {pricing.outsideCoachFee > 0 && <div className="slip-row"><span className="slip-label">{t('booking.outsideCoachFee')}</span><span className="slip-value">฿{pricing.outsideCoachFee.toLocaleString()}</span></div>}
                {pricing.creditDiscount > 0 && <div className="slip-row"><span className="slip-label">{t('booking.creditDiscount')}</span><span className="slip-value" style={{ color: 'var(--red-500)' }}>-฿{pricing.creditDiscount.toLocaleString()}</span></div>}
                <div className="slip-divider" />
                <div className="slip-row slip-total">
                  <span className="slip-label" style={{ fontWeight: 600, fontSize: '16px' }}>{t('booking.total')}</span>
                  <span className="slip-value">฿{pricing.total.toLocaleString()}</span>
                </div>
              </div>

              <div className="qr-section">
                <p style={{ fontWeight: 600, marginBottom: '8px' }}>{t('booking.scanQr')}</p>
                {PAYMENT_QR_IMAGE ? (
                  <img src={PAYMENT_QR_IMAGE} alt="Payment QR" style={{ width: '160px', height: '160px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                ) : (
                  <div className="qr-placeholder">QR</div>
                )}
                <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '8px' }}>
                  {settings.payment?.payment_bank_name} - {settings.payment?.payment_account_number}<br />
                  {settings.payment?.payment_account_name}
                </p>
                {PAYMENT_QR_IMAGE ? (
                  <a href={DOWNLOAD_QR_IMAGE} download="B-Space.payment-qr.png" className="btn btn-outline" style={{ display: 'inline-block', marginTop: '10px', fontSize: '13px', padding: '6px 18px', textDecoration: 'none' }}>Download QR</a>
                ) : (
                  <button className="btn btn-outline" disabled style={{ marginTop: '10px', fontSize: '13px', padding: '6px 18px', opacity: 0.45 }}>Download QR</button>
                )}
              </div>

              <label className="file-upload" style={{ borderRadius: '0', display: 'block' }}>
                <input type="file" accept="image/*" onChange={handlePaymentSlipChange} style={{ display: 'none' }} />
                {paymentSlipPreview ? (
                  <img src={paymentSlipPreview} alt="slip" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
                ) : (
                  <><div className="file-upload-text">{t('booking.uploadSlip')}</div></>

                )}
              </label>

              <button className="btn btn-gold" onClick={handleSubmitPayment} disabled={submitting || !paymentSlip} style={{ marginTop: '20px' }}>
                {submitting ? t('common.loading') : t('booking.submit')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ============== ZERO-TOTAL CONFIRMATION MODAL ============== */}
      {showZeroTotalModal && (
        <div className="modal-overlay" onClick={() => !loading && setShowZeroTotalModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 style={{ fontSize: '18px' }}>Confirm Booking</h3></div>
            <div style={{ padding: '12px 0' }}>
              <p style={{ fontSize: '14px', color: 'var(--gray-700)', marginBottom: '8px' }}>
                Your credits cover the full booking amount of <strong style={{ color: 'var(--green-700)' }}>฿{pricing.subtotal.toLocaleString()}</strong>.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>No payment slip required. Your booking will be confirmed immediately.</p>
            </div>
            <div style={{ background: 'var(--green-50)', borderRadius: '8px', padding: '10px 12px', margin: '8px 0 16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--gray-600)' }}>Credits used</span><span style={{ fontWeight: 600, color: 'var(--green-700)' }}>-฿{pricing.creditDiscount.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}><span style={{ color: 'var(--gray-600)' }}>Amount due</span><span style={{ fontWeight: 700, color: 'var(--green-800)' }}>฿0</span></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline" onClick={() => setShowZeroTotalModal(false)} disabled={loading} style={{ flex: 1 }}>Back</button>
              <button className="btn btn-gold" onClick={handleZeroTotalBooking} disabled={loading} style={{ flex: 1 }}>{loading ? 'Confirming...' : 'Confirm Booking'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ============== SWAP CONFIRMATION MODAL ============== */}
      {pendingSwap && (
        <div className="modal-overlay" onClick={() => !loading && setPendingSwap(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 style={{ fontSize: '18px' }}>Release current reservation?</h3></div>
            <div style={{ padding: '12px 0' }}>
              <p style={{ fontSize: '14px', color: 'var(--gray-700)', marginBottom: '8px' }}>
                You have a reservation for <strong>{provisionalBooking?.startTime}–{provisionalBooking?.endTime}</strong> on the {format(new Date((typeof provisionalBooking?.date === 'string' ? provisionalBooking.date.slice(0,10) : provisionalBooking?.date) + 'T12:00:00'), 'dd MMM')}.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                Continuing will release it and reserve your new selection. A fresh 15-minute timer will start.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline" onClick={() => setPendingSwap(null)} disabled={loading} style={{ flex: 1 }}>Keep current</button>
              <button
                className="btn btn-gold"
                onClick={async () => {
                  const replaceId = pendingSwap.replaceId;
                  setPendingSwap(null);
                  await createOrSwapProvisional(replaceId);
                }}
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? 'Swapping...' : 'Swap reservation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingFlowPage;
