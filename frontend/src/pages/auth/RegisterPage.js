import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';

const RegisterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', gender: '', dateOfBirth: '', occupation: ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      return toast.error('Name and phone number are required');
    }

    if (!/^0[0-9]{9}$/.test(form.phone)) {
      return toast.error('Phone number must be 10 digits starting with 0 (e.g., 0812345678)');
    }

    if (!form.email.trim() || !form.gender || !form.dateOfBirth) {
      return toast.error('Email, gender, and date of birth are required');
    }

    setLoading(true);
    try {
      await authAPI.register(form);
      toast.success(t('auth.otpSent'));
      navigate('/otp', { state: { phone: form.phone, name: form.name, mode: 'register' } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <img src="/B-Space_Logo_removedbg.png" alt="B·Space Tennis Club" style={{ width: '200px', marginBottom: '32px' }} />
      <div className="auth-card">
        <h2 className="auth-title">{t('auth.register')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.name')} *</label>
            <input type="text" name="name" className="form-input" placeholder={t('auth.enterName')} value={form.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>{t('auth.phone')} *</label>
            <input type="tel" name="phone" className="form-input" placeholder="0812345678" value={form.phone} onChange={handleChange} maxLength={10} pattern="0[0-9]{9}" required />
          </div>
          <div className="form-group">
            <label>{t('auth.email')} *</label>
            <input type="email" name="email" className="form-input" placeholder="email@example.com" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>{t('auth.gender')} *</label>
            <select name="gender" className="form-select" value={form.gender} onChange={handleChange} required>
              <option value="">--</option>
              <option value="male">{t('auth.male')}</option>
              <option value="female">{t('auth.female')}</option>
              <option value="other">{t('auth.other')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('auth.dateOfBirth')} *</label>
            <input type="date" name="dateOfBirth" className="form-input" value={form.dateOfBirth} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>{t('auth.occupation')}</label>
            <input type="text" name="occupation" className="form-input" placeholder="e.g. Engineer" value={form.occupation} onChange={handleChange} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('common.loading') : t('auth.register')}
          </button>
        </form>
        <div className="auth-link">
          {t('auth.hasAccount')}{' '}
          <Link to="/login">{t('auth.loginNow')}</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
