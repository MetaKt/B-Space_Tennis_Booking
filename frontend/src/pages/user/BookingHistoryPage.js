import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { bookingAPI, settingsAPI } from '../../utils/api';
import PendingPaymentModal from '../../components/user/PendingPaymentModal';

const BookingHistoryPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [paymentModal, setPaymentModal] = useState(null);
  const [cancellationHours, setCancellationHours] = useState(0);

  useEffect(() => {
    fetchHistory();
  }, [filter, page]);

  useEffect(() => {
    settingsAPI.getPublic()
      .then((res) => setCancellationHours(Number(res.data.data?.court_operations?.cancellation_hours) || 0))
      .catch(() => {});
  }, []);

  // A confirmed booking can only be cancelled up to `cancellationHours` before start.
  const canCancelNow = (booking) => {
    if (!cancellationHours) return true;
    const dateStr = booking.date.slice(0, 10);
    const start = new Date(`${dateStr}T${booking.startTime}:00+07:00`);
    return (start.getTime() - Date.now()) / (60 * 60 * 1000) >= cancellationHours;
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (filter !== 'all') params.status = filter;
      const res = await bookingAPI.getHistory(params);
      setBookings(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error('Failed to load booking history');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    try {
      await bookingAPI.cancel(cancelModal.id, { reason: cancelReason });
      toast.success(t('booking.cancelSuccess'));
      setCancelModal(null);
      setCancelReason('');
      fetchHistory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Cancel failed');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      upcoming: 'var(--blue-500)',
      completed: 'var(--green-600)',
      cancelled: 'var(--red-500)',
      no_show: 'var(--amber-500)'
    };
    return colors[status] || 'var(--gray-500)';
  };

  const getPaymentColor = (status) => {
    const colors = {
      pending: 'var(--amber-500)',
      submitted: 'var(--blue-500)',
      confirmed: 'var(--green-600)',
      cancelled: 'var(--red-500)',
      refunded: 'var(--gray-500)',
      pending_refund: 'var(--amber-600)'
    };
    return colors[status] || 'var(--gray-500)';
  };

  const coachStatusColors = { active: 'var(--green-600)', cancelled: 'var(--red-500)', changed: 'var(--amber-600)' };

  // Compute what refund the user would receive if they cancel now
  const getCancelRefundAmount = (booking) => {
    if (booking.paymentStatus === 'pending') {
      return booking.additionalAmountDue > 0
        ? booking.totalPrice + booking.creditUsed
        : booking.creditUsed;
    }
    if (booking.paymentStatus === 'confirmed') return booking.totalPrice + booking.creditUsed;
    return 0; // submitted or pending_refund — no immediate refund shown
  };

  const filters = ['all', 'upcoming', 'completed', 'cancelled'];

  return (
    <div className="mobile-wrapper">
      {/* Header */}
      <div style={{
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px',
        borderBottom: '1px solid var(--gray-200)'
      }}>
        <button className="back-btn" onClick={() => navigate('/')} style={{ background: 'var(--gray-100)', color: 'var(--green-800)' }}>←</button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--green-900)' }}>
          {t('home.bookingHistory')}
        </h2>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: '8px', padding: '12px 20px',
        overflowX: 'auto', borderBottom: '1px solid var(--gray-100)'
      }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            style={{
              padding: '6px 16px', borderRadius: '20px', fontSize: '13px',
              fontWeight: 500, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: filter === f ? 'var(--green-800)' : 'var(--gray-100)',
              color: filter === f ? 'white' : 'var(--gray-600)'
            }}
          >
            {f === 'all' ? t('common.all') : t(`common.${f}`)}
          </button>
        ))}
      </div>

      {/* Bookings */}
      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : bookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-text">{t('booking.noBookings')}</div>
          </div>
        ) : (
          bookings.map((booking) => {
            const hasCoach = booking.coachOption !== 'none';
            const coachName = booking.coach?.nickname || booking.coach?.name || booking.outsideCoachName || '';
            const coachStatusColor = coachStatusColors[booking.coachStatus] || 'var(--gray-500)';
            const refundAmount = getCancelRefundAmount(booking);

            return (
              <div key={booking.id} style={{ marginBottom: '12px' }}>
                {/* ── COURT ROW ── */}
                <div className="booking-card" style={{ marginBottom: hasCoach ? '2px' : '0', borderRadius: hasCoach ? '12px 12px 0 0' : '12px' }}>
                  <div className="booking-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'var(--green-100)', color: 'var(--green-800)', letterSpacing: '0px' }}>COURT</span>
                      <span className="booking-card-court">{t('booking.courtNumber')} {booking.court?.courtNumber} - {booking.court?.name}</span>
                    </div>
                    <span className={`status-badge status-${booking.status}`}>{t(`common.${booking.status}`)}
                    </span>
                  </div>

                  <div className="booking-card-details">
                    <span className="booking-card-detail">{format(new Date(booking.date.slice(0, 10) + 'T12:00:00'), 'dd MMM yyyy')}</span>
                    <span className="booking-card-detail">{booking.startTime} - {booking.endTime}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--gray-100)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 6px', borderRadius: '8px', background: `${getPaymentColor(booking.paymentStatus)}15`, color: getPaymentColor(booking.paymentStatus) }}>
                        {t(`common.${booking.paymentStatus}`)}
                      </span>
                      <span className="booking-card-id" style={{ marginTop: 0 }}>{booking.bookingId}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--green-800)' }}>฿{booking.courtPrice?.toLocaleString()}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {booking.additionalAmountDue > 0 && booking.paymentStatus === 'pending' && (
                          <button onClick={() => setPaymentModal(booking)} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: 'none', color: '#fff', background: 'var(--amber-500)', cursor: 'pointer', fontWeight: 600 }}>
                            {t('common.pay_difference')} ฿{booking.additionalAmountDue?.toLocaleString()}
                          </button>
                        )}
                        {booking.status === 'upcoming' && (
                          canCancelNow(booking) ? (
                            <button onClick={() => setCancelModal(booking)} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--red-300)', color: 'var(--red-500)', background: 'white', cursor: 'pointer', fontWeight: 500 }}>
                              {t('common.cancel')}
                            </button>
                          ) : (
                            <span title={t('booking.cancelWindowPassed', { hours: cancellationHours })} style={{ fontSize: '10px', color: 'var(--gray-400)', maxWidth: '110px', textAlign: 'right', lineHeight: 1.3 }}>
                              {t('booking.cancelWindowPassed', { hours: cancellationHours })}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── COACH ROW (only when coach is booked) ── */}
                {hasCoach && (
                  <div className="booking-card" style={{ borderRadius: '0 0 12px 12px', borderTop: '1px dashed var(--gray-200)', background: 'var(--gray-50)' }}>
                    <div className="booking-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'var(--blue-100)', color: 'var(--blue-800)', letterSpacing: '0px' }}>COACH</span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-700)' }}>
                          {coachName || (booking.coachOption === 'outside' ? 'Outside Coach' : 'Coach')}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              ←
            </button>
            <span style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--gray-500)' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '12px' }}>{t('booking.cancelBooking')}</h3>
            <p style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '16px' }}>
              {t('booking.cancelConfirm')}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--green-700)', marginBottom: '12px', fontWeight: 500 }}>
              {t('booking.refundCredit')}: ฿{getCancelRefundAmount(cancelModal)?.toLocaleString()}
            </p>
            <div className="form-group">
              <textarea
                className="form-input"
                placeholder={t('booking.cancelReason')}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-outline" onClick={() => setCancelModal(null)} style={{ flex: 1 }}>
                {t('common.back')}
              </button>
              <button className="btn btn-danger" onClick={handleCancel} style={{ flex: 1 }}>
                {t('booking.confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <PendingPaymentModal
          booking={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => fetchHistory()}
        />
      )}
    </div>
  );
};

export default BookingHistoryPage;
