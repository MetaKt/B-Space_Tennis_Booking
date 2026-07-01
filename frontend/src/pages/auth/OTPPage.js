import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const OTPPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const { phone, name, mode } = location.state || {};
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!phone) navigate('/login');
    inputRefs.current[0]?.focus();
  }, [phone, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (newOtp.every(d => d !== '') && value) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    pasted.split('').forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    if (pasted.length === 6) handleVerify(pasted);
  };

  const handleVerify = async (otpString) => {
    setLoading(true);
    try {
      const res = await authAPI.verifyOTP(phone, otpString || otp.join(''));
      const { token, refreshToken, user } = res.data.data;
      await login(token, user, refreshToken);
      toast.success('Login successful!');

      if (['admin', 'master_admin'].includes(user.role)) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await authAPI.resendOTP(phone);
      toast.success(t('auth.otpSent'));
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error) {
      toast.error('Failed to resend OTP');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <button
          onClick={() => navigate('/login')}
          style={{
            alignSelf: 'flex-start', background: 'none', border: 'none',
            color: 'var(--gray-500)', cursor: 'pointer', fontSize: '14px',
            fontWeight: 500, padding: '0 0 12px 0', display: 'flex',
            alignItems: 'center', gap: '4px'
          }}
        >
          ← {t('common.back')}
        </button>
        <div className="auth-logo">
          <h1>{t('auth.verifyOtp')}</h1>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: '14px', marginBottom: '24px' }}>
          {t('auth.otpSent')}<br />
          <strong style={{ color: 'var(--gray-800)' }}>{phone}</strong>
        </p>

        <div className="otp-inputs" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              className="otp-input"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              inputMode="numeric"
            />
          ))}
        </div>

        <button
          className="btn btn-primary"
          onClick={() => handleVerify()}
          disabled={loading || otp.some(d => d === '')}
        >
          {loading ? t('common.loading') : t('auth.verifyOtp')}
        </button>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          {countdown > 0 ? (
            <span style={{ color: 'var(--gray-400)', fontSize: '14px' }}>
              {t('auth.resendOtp')} ({countdown}s)
            </span>
          ) : (
            <button
              onClick={handleResend}
              style={{
                background: 'none', border: 'none', color: 'var(--green-600)',
                fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: 'var(--font-body)'
              }}
            >
              {t('auth.resendOtp')}
            </button>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--gray-400)' }}>
          DEV MODE: Check server console for OTP
        </p>
      </div>
    </div>
  );
};

export default OTPPage;
