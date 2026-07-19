import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { bookingAPI } from '../../utils/api';
import { format } from 'date-fns';
import PendingPaymentModal from '../../components/user/PendingPaymentModal';

const HomePage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, updateLanguage } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null);
  const [logoutPrompt, setLogoutPrompt] = useState(null); // { provisional } when user has active reservation
  // tick state forces re-render every second so provisional countdowns stay live
  const [, setTick] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => {
    fetchUpcoming();
  }, []);

  // Live countdown ticker — re-renders provisional cards every second so the
  // mm:ss display stays current and expired ones disappear automatically.
  useEffect(() => {
    const hasActiveProvisional = upcomingBookings.some(
      b => b.bookingStatus === 'provisional' && b.expiresAt && new Date(b.expiresAt) > new Date()
    );
    if (!hasActiveProvisional) return;
    const interval = setInterval(() => {
      // Drop any provisional that just expired
      setUpcomingBookings(prev =>
        prev.filter(b => b.bookingStatus !== 'provisional' || !b.expiresAt || new Date(b.expiresAt) > new Date())
      );
      setTick(n => n + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [upcomingBookings]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUpcoming = async () => {
    try {
      const res = await bookingAPI.getUpcoming();
      setUpcomingBookings(res.data.data);
    } catch (error) {
      console.error('Failed to fetch upcoming bookings');
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'th' : 'en';
    i18n.changeLanguage(newLang);
    updateLanguage(newLang);
  };

  const handleLogout = async () => {
    // If user has an active provisional, prompt before logging out — otherwise
    // their reservation would silently stay alive until expiry on the server.
    const activeProvisional = upcomingBookings.find(
      b => b.bookingStatus === 'provisional' && b.expiresAt && new Date(b.expiresAt) > new Date()
    );
    if (activeProvisional) {
      setLogoutPrompt({ provisional: activeProvisional });
      setShowMenu(false);
      return;
    }
    await logout();
    navigate('/login');
  };

  // Confirmed by user from the logout-prompt modal: cancel the provisional, then log out.
  const handleConfirmLogoutWithCancel = async () => {
    if (!logoutPrompt?.provisional) return;
    try {
      await bookingAPI.cancel(logoutPrompt.provisional.id, { reason: 'user_logged_out' });
    } catch (e) { /* ignore — provisional may already have expired */ }
    setLogoutPrompt(null);
    await logout();
    navigate('/login');
  };

  // Resume = navigate into the booking flow at /book?resume=<id>
  const handleResume = (booking) => {
    navigate(`/book?resume=${booking.id}`);
  };

  // Release a provisional from the home screen (e.g. user changed their mind)
  const handleReleaseProvisional = async (booking) => {
    try {
      await bookingAPI.cancel(booking.id, { reason: 'released_from_home' });
      toast.success(t('provisional.released'));
      fetchUpcoming();
    } catch (e) {
      toast.error(e.response?.data?.message || t('provisional.releaseFailed'));
    }
  };

  // mm:ss countdown helper
  const formatTimeLeft = (expiresAt) => {
    const s = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="mobile-wrapper">
      {/* Header */}
      <div className="home-header">
        <div className="home-topbar">
          <div className="home-user">
            <div>
              <div className="home-welcome">{t('home.welcome')}</div>
              <div className="home-user-name">{user?.name}</div>
            </div>
            {/* <img src="/B-Space_Logo_removedbg.png" alt="B·Space Tennis Club" className="home-logo" /> */}
          </div>
          <img src="/B-Space_Logo_removedbg.png" alt="B·Space Tennis Club" className="home-logo" />
          <div className="home-actions">
            <button className="icon-btn" onClick={toggleLanguage} title={t('home.changeLang')}>
              {i18n.language === 'en' ? 'TH' : 'EN'}
            </button>
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>☰</button>
              {showMenu && (
                <div className="dropdown-menu">
                  <button className="dropdown-item" onClick={() => { setShowMenu(false); navigate('/profile'); }}>
                    {t('home.personalInfo')}
                  </button>
                  <button className="dropdown-item" onClick={() => { setShowMenu(false); navigate('/history'); }}>
                    {t('home.bookingHistory')}
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item danger" onClick={handleLogout}>
                    {t('auth.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Credit Card */}
        <div className="credit-card">
          <div className="credit-label">{t('home.credit')}</div>
          <div className="credit-amount">
            <span>฿</span> {(user?.credit || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Book Now Button */}
      <div className="book-now-section">
        <button className="book-now-btn" onClick={() => navigate('/book')}>
          {t('home.bookNow')}
        </button>
      </div>

      {/* Upcoming Bookings */}
      <div className="section-title">{t('home.upcoming')}</div>
      <div className="upcoming-list">
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : upcomingBookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-text">{t('home.noUpcoming')}</div>
          </div>
        ) : (
          upcomingBookings.map((booking) => {
            // ===== PROVISIONAL CARD (yellow, countdown, Continue CTA) =====
            if (booking.bookingStatus === 'provisional') {
              const timeLeft = formatTimeLeft(booking.expiresAt);
              const secondsLeft = Math.max(0, Math.floor((new Date(booking.expiresAt).getTime() - Date.now()) / 1000));
              const urgent = secondsLeft < 120;
              return (
                <div
                  key={booking.id}
                  className="booking-card"
                  style={{
                    marginBottom: '12px',
                    background: urgent ? '#fef2f2' : '#fff8e1',
                    border: `1px solid ${urgent ? '#fca5a5' : '#fcd34d'}`,
                  }}
                >
                  <div className="booking-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: urgent ? '#fee2e2' : '#fef3c7', color: urgent ? '#b91c1c' : '#92400e', letterSpacing: '0px' }}>
                        {t('provisional.reserved')}
                      </span>
                      <span className="booking-card-court">{t('booking.courtNumber')} {booking.court?.courtNumber} - {booking.court?.name}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: urgent ? '#b91c1c' : '#92400e', fontSize: '15px' }}>
                      {timeLeft}
                    </span>
                  </div>
                  <div className="booking-card-details">
                    <span className="booking-card-detail">{format(new Date(booking.date.slice(0, 10) + 'T12:00:00'), 'dd MMM yyyy')}</span>
                    <span className="booking-card-detail">{booking.startTime} - {booking.endTime}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: urgent ? '#b91c1c' : '#92400e', marginTop: '6px' }}>
                    {t('provisional.expiresIn', { time: timeLeft })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      onClick={() => handleReleaseProvisional(booking)}
                      style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--gray-300)', background: '#fff', cursor: 'pointer', fontWeight: 500 }}
                    >
                      {t('provisional.release')}
                    </button>
                    <button
                      onClick={() => handleResume(booking)}
                      style={{ flex: 2, padding: '8px', fontSize: '13px', borderRadius: '6px', border: 'none', color: '#fff', background: urgent ? '#dc2626' : '#d97706', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {t('provisional.continue')}
                    </button>
                  </div>
                </div>
              );
            }

            // ===== CONFIRMED BOOKING CARD (unchanged below) =====
            const hasCoach = booking.coachOption !== 'none';
            const coachName = booking.coach?.nickname || booking.coach?.name || booking.outsideCoachName || '';
            const coachStatusColors = { active: 'var(--green-600)', cancelled: 'var(--red-500)', changed: 'var(--amber-600)' };
            const coachStatusColor = coachStatusColors[booking.coachStatus] || 'var(--gray-500)';

            return (
              <div key={booking.id} style={{ marginBottom: '12px' }}>
                {/* ── COURT ROW ── */}
                <div className="booking-card" style={{ marginBottom: hasCoach ? '2px' : '0', borderRadius: hasCoach ? '12px 12px 0 0' : '12px' }}>
                  <div className="booking-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'var(--green-100)', color: 'var(--green-800)', letterSpacing: '0px' }}>{t('booking.court').toUpperCase()}</span>
                      <span className="booking-card-court">{t('booking.courtNumber')} {booking.court?.courtNumber} - {booking.court?.name}</span>
                    </div>
                    <span className={`status-badge status-${booking.status}`}>{t(`common.${booking.status}`)}</span>
                  </div>
                  <div className="booking-card-details">
                    <span className="booking-card-detail">{format(new Date(booking.date.slice(0, 10) + 'T12:00:00'), 'dd MMM yyyy')}</span>
                    <span className="booking-card-detail">{booking.startTime} - {booking.endTime}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--gray-100)' }}>
                    <span className="booking-card-id" style={{ marginTop: 0 }}>{booking.bookingId}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--green-800)' }}>฿{booking.courtPrice?.toLocaleString()}</span>
                      {/* Additional payment due after coach upgrade */}
                      {booking.additionalAmountDue > 0 && booking.paymentStatus === 'pending' && (
                        <button onClick={() => setPaymentModal(booking)} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: 'none', color: '#fff', background: 'var(--amber-500)', cursor: 'pointer', fontWeight: 600 }}>
                          {t('common.pay_difference')} ฿{booking.additionalAmountDue?.toLocaleString()}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── COACH ROW (only when coach is booked) ── */}
                {hasCoach && (
                  <div className="booking-card" style={{ borderRadius: '0 0 12px 12px', borderTop: '1px dashed var(--gray-200)', background: 'var(--gray-50)' }}>
                    <div className="booking-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'var(--blue-100)', color: 'var(--blue-800)', letterSpacing: '0px' }}>{t('booking.coach').toUpperCase()}</span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-700)' }}>
                          {coachName || (booking.coachOption === 'outside' ? t('booking.outsideCoachLabel') : t('booking.coach'))}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: `${coachStatusColor}20`, color: coachStatusColor }}>
                        {t(`common.coach_${booking.coachStatus || 'active'}`)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--green-800)' }}>฿{booking.coachPrice?.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <PendingPaymentModal
          booking={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => fetchUpcoming()}
        />
      )}

      {/* Logout-with-active-provisional confirmation */}
      {logoutPrompt && (
        <div className="modal-overlay" onClick={() => setLogoutPrompt(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 style={{ fontSize: '18px' }}>{t('provisional.pendingTitle')}</h3></div>
            <div style={{ padding: '12px 0' }}>
              <p style={{ fontSize: '14px', color: 'var(--gray-700)', marginBottom: '8px' }}>
                {t('provisional.pendingBody', {
                  court: logoutPrompt.provisional.court?.courtNumber,
                  start: logoutPrompt.provisional.startTime,
                  end: logoutPrompt.provisional.endTime,
                })} <strong style={{ color: 'var(--red-600)' }}>{formatTimeLeft(logoutPrompt.provisional.expiresAt)}</strong>
              </p>
              <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                {t('provisional.logoutWarning')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline" onClick={() => setLogoutPrompt(null)} style={{ flex: 1 }}>{t('provisional.stayLoggedIn')}</button>
              <button
                className="btn"
                onClick={handleConfirmLogoutWithCancel}
                style={{ flex: 1, background: 'var(--red-500, #ef4444)', color: '#fff' }}
              >
                {t('provisional.cancelAndLogout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
