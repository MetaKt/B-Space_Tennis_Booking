import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const BookingSuccessPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="mobile-wrapper">
      <div className="success-page">
        <div className="success-icon" style={{
          width: '100px', height: '100px', borderRadius: '50%',
          background: 'var(--green-100)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '60px auto 24px', fontSize: '48px',
          animation: 'scaleIn 0.5s ease'
        }}>
          ✓
        </div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: '28px',
          color: 'var(--green-900)', textAlign: 'center', marginBottom: '8px'
        }}>
          {t('booking.bookingSuccess')}
        </h2>
        <p style={{
          color: 'var(--gray-500)', textAlign: 'center', marginBottom: '8px', fontSize: '14px'
        }}>
          {t('booking.bookingSuccessMsg')}
        </p>
        <div style={{
          background: 'var(--gray-100)', borderRadius: '8px', padding: '12px 20px',
          textAlign: 'center', fontWeight: 600, fontSize: '16px', color: 'var(--green-800)',
          marginBottom: '40px', letterSpacing: '0.1px'
        }}>
          {id}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/')}
          style={{ width: '100%' }}
        >
          {t('booking.backToHome')}
        </button>
      </div>
    </div>
  );
};

export default BookingSuccessPage;
