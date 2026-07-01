import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return toast.error('Please enter your phone number');

    if (!/^0[0-9]{9}$/.test(phone)) {
      return toast.error('Phone number must be 10 digits starting with 0 (e.g., 0812345678)');
    }

    setLoading(true);
    try {
      const res = await authAPI.login(phone);
      toast.success(t('auth.otpSent'));
      navigate('/otp', { state: { phone, name: res.data.data.name, mode: 'login' } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <img src="/B-Space_Logo_removedbg.png" alt="B·Space Tennis Club" style={{ width: '200px', marginBottom: '32px' }} />
      <div className="auth-card">
        <h2 className="auth-title">{t('auth.login')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.phone')}</label>
            <input
              type="tel"
              className="form-input"
              placeholder="0812345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={10}
              pattern="0[0-9]{9}"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('common.loading') : t('auth.sendOtp')}
          </button>
        </form>
        <div className="auth-link">
          {t('auth.noAccount')}{' '}
          <Link to="/register">{t('auth.registerNow')}</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
