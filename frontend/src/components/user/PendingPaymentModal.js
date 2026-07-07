import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { bookingAPI } from '../../utils/api';
import { shareOrDownloadImage } from '../../utils/shareImage';
import { useAuth } from '../../context/AuthContext';

const PAYMENT_QR_IMAGE = '/QR_Code.png';
const DOWNLOAD_QR_IMAGE = '/QR_Code_FULL.jpg';

const PendingPaymentModal = ({ booking, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [paymentSlip, setPaymentSlip] = useState(null);
  const [paymentSlipPreview, setPaymentSlipPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ mins: 0, secs: 0, expired: false });
  const [useCredit, setUseCredit] = useState(false);

  // When a coach was upgraded and additional payment is owed, show only the difference amount
  const isCoachDifferencePayment = booking.additionalAmountDue > 0;
  const amountDue = isCoachDifferencePayment ? booking.additionalAmountDue : booking.totalPrice;

  const creditAvailable = user?.credit || 0;
  const creditToUse = useCredit ? Math.min(creditAvailable, amountDue) : 0;
  const effectiveAmountDue = amountDue - creditToUse;

  // Update timer every second — only runs when booking has an expiry
  useEffect(() => {
    if (!booking.expiresAt) return;

    const updateTimer = () => {
      const expiresAt = new Date(booking.expiresAt);
      const now = new Date();
      const diffMs = expiresAt - now;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      setTimeRemaining({ mins: Math.max(0, diffMins), secs: Math.max(0, diffSecs), expired: diffMs <= 0 });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [booking.expiresAt]);

  const handlePaymentSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentSlip(file);
      setPaymentSlipPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitPayment = async () => {
    if (effectiveAmountDue > 0 && !paymentSlip) {
      return toast.error('Please upload payment slip');
    }

    setSubmitting(true);
    try {
      if (creditToUse > 0) {
        await bookingAPI.confirmPayment(booking.id, { creditUsed: creditToUse });
        updateUser({ credit: (user.credit || 0) - creditToUse });
      }
      if (effectiveAmountDue > 0) {
        const formData = new FormData();
        formData.append('paymentSlip', paymentSlip);
        await bookingAPI.uploadPaymentSlip(booking.id, formData);
      }
      toast.success(t('booking.paymentSubmitted'));
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload payment slip');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3 style={{ fontSize: '18px' }}>{t('booking.completePayment')}</h3>
          <button
            className="modal-close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--gray-500)',
              padding: '0'
            }}
          >
            ✕
          </button>
        </div>

        {/* Booking Details */}
        <div className="slip-card" style={{ marginBottom: '12px', padding: '16px' }}>
          {isCoachDifferencePayment && (
            <div style={{
              background: 'var(--amber-50)', border: '1px solid var(--amber-300)',
              borderRadius: '6px', padding: '8px 10px', marginBottom: '10px',
              fontSize: '12px', color: 'var(--amber-700)', fontWeight: 500
            }}>
              {t('common.coach_changed')} — {t('common.additional_payment_due')}
            </div>
          )}
          <div className="slip-row" style={{ fontSize: '12px', padding: '6px 0' }}>
            <span className="slip-label" style={{ fontSize: '12px' }}>{t('booking.bookingId')}</span>
            <span className="slip-value" style={{ fontSize: '12px' }}>{booking.bookingId}</span>
          </div>
          <div className="slip-row" style={{ fontSize: '12px', padding: '6px 0' }}>
            <span className="slip-label" style={{ fontSize: '12px' }}>{t('booking.court')}</span>
            <span className="slip-value" style={{ fontSize: '12px' }}>
              {t('booking.courtNumber')} {booking.court?.courtNumber} - {booking.court?.name}
            </span>
          </div>
          <div className="slip-row" style={{ fontSize: '12px', padding: '6px 0' }}>
            <span className="slip-label" style={{ fontSize: '12px' }}>{t('booking.date')}</span>
            <span className="slip-value" style={{ fontSize: '12px' }}>{format(new Date(booking.date.slice(0, 10) + 'T12:00:00'), 'dd MMM yyyy')}</span>
          </div>
          <div className="slip-row" style={{ fontSize: '12px', padding: '6px 0' }}>
            <span className="slip-label" style={{ fontSize: '12px' }}>{t('booking.time')}</span>
            <span className="slip-value" style={{ fontSize: '12px' }}>{booking.startTime} - {booking.endTime}</span>
          </div>
          <div className="slip-divider" style={{ margin: '8px 0' }} />
          <div className="slip-row slip-total" style={{ fontSize: '14px', padding: '8px 0' }}>
            <span className="slip-label" style={{ fontSize: '12px', fontWeight: 500 }}>
              {isCoachDifferencePayment ? t('common.pay_difference') : t('booking.amount')}
            </span>
            <span className="slip-value" style={{ fontSize: '16px', color: 'var(--green-700)' }}>
              ฿{amountDue?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Expiration Warning — only shown when booking has a time limit and it hasn't expired */}
        {booking.expiresAt && !timeRemaining.expired && (
          <div
            style={{
              background: 'var(--amber-100)',
              border: '1px solid var(--amber-500)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px',
              marginBottom: '12px',
              fontSize: '12px',
              color: 'var(--amber-700)',
              textAlign: 'center',
              fontWeight: 600
            }}
          >
            {t('booking.paymentExpires')} {timeRemaining.mins}m {timeRemaining.secs}s
          </div>
        )}

        {/* QR Code Section */}
        <div className="qr-section" style={{ padding: '12px', margin: '12px 0' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
            {t('booking.paymentMethod')}
          </h4>
          {PAYMENT_QR_IMAGE ? (
            <img src={PAYMENT_QR_IMAGE} alt="Payment QR" style={{ width: '140px', height: '140px', objectFit: 'contain', display: 'block', margin: '8px auto' }} />
          ) : (
            <div className="qr-placeholder" style={{ width: '140px', height: '140px', margin: '8px auto', fontSize: '40px' }}>
              QR
            </div>
          )}
          <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '6px', textAlign: 'center' }}>
            QR Code or Bank Details
          </p>
          {PAYMENT_QR_IMAGE ? (
            <button
              onClick={() => shareOrDownloadImage(DOWNLOAD_QR_IMAGE, 'B-Space.payment-qr.png')}
              className="btn btn-outline"
              style={{ display: 'block', width: '100%', marginTop: '8px', fontSize: '12px', padding: '5px 16px', textAlign: 'center' }}
            >
              Download QR
            </button>
          ) : (
            <button className="btn btn-outline" disabled style={{ display: 'block', width: '100%', marginTop: '8px', fontSize: '12px', padding: '5px 16px', opacity: 0.45 }}>
              Download QR
            </button>
          )}
        </div>

        {/* Credit Usage */}
        {creditAvailable > 0 && (
          <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-200)', borderRadius: 'var(--radius-lg)', padding: '10px 12px', margin: '0 0 12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--green-800)' }}>
              <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
              {t('booking.useCredit')} (฿{creditAvailable.toLocaleString()})
            </label>
            {useCredit && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--green-200)', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--gray-600)' }}>Credit applied</span>
                  <span style={{ fontWeight: 600, color: 'var(--red-500)' }}>-฿{creditToUse.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ color: 'var(--gray-600)' }}>Remaining to pay</span>
                  <span style={{ fontWeight: 700, color: effectiveAmountDue === 0 ? 'var(--green-700)' : 'var(--gray-800)' }}>
                    ฿{effectiveAmountDue.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Slip Upload — hidden when credits cover the full amount */}
        <div style={{ marginTop: '12px', display: effectiveAmountDue === 0 ? 'none' : 'block' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
            {t('booking.uploadPaymentSlip')}
          </h4>

          <div
            className="file-upload"
            onClick={() => document.getElementById('payment-slip-input')?.click()}
            style={{ padding: '16px', marginTop: '8px', borderRadius: '0', border: '2px dashed var(--gray-300)', cursor: 'pointer' }}
          >
            <div className="file-upload-icon" style={{ fontSize: '28px', marginBottom: '6px' }}></div>
            <div className="file-upload-text" style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
              {paymentSlip ? paymentSlip.name : t('booking.selectFile')}
            </div>
          </div>

          <input
            id="payment-slip-input"
            type="file"
            accept="image/jpg,image/jpeg,image/png,image/webp,.pdf"
            onChange={handlePaymentSlipChange}
            style={{ display: 'none' }}
          />

          {paymentSlipPreview && (
            <div style={{ marginTop: '10px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxHeight: '150px' }}>
              {paymentSlip.type.startsWith('image/') ? (
                <img
                  src={paymentSlipPreview}
                  alt="Preview"
                  style={{ width: '100%', maxHeight: '150px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    background: 'var(--gray-100)',
                    padding: '12px',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'var(--gray-600)'
                  }}
                >
                  {paymentSlip.name}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            className="btn btn-outline"
            onClick={onClose}
            style={{ flex: 1, padding: '10px 16px', fontSize: '13px' }}
          >
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-gold"
            onClick={handleSubmitPayment}
            disabled={(effectiveAmountDue > 0 && !paymentSlip) || submitting}
            style={{ flex: 1, padding: '10px 16px', fontSize: '13px' }}
          >
            {submitting ? t('common.loading') : effectiveAmountDue === 0 ? 'Confirm with Credits' : t('booking.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingPaymentModal;
