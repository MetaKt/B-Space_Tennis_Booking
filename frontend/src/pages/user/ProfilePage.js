import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../utils/api';

const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser, updateLanguage } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    age: user?.age || '',
    gender: user?.gender || '',
    dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
    occupation: user?.occupation || ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      const res = await userAPI.updateProfile(form);
      updateUser(res.data.data);
      toast.success(t('common.saved'));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Max file size: 5MB');

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await userAPI.uploadAvatar(formData);
      updateUser({ avatar: res.data.data.avatar });
      toast.success('Avatar updated');
    } catch (error) {
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'th' : 'en';
    i18n.changeLanguage(newLang);
    updateLanguage(newLang);
  };

  const getInitials = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: '10px',
    border: '1px solid var(--gray-200)', fontSize: '14px',
    background: 'var(--gray-50)', outline: 'none'
  };

  const labelStyle = {
    fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)',
    marginBottom: '4px', display: 'block'
  };

  return (
    <div className="mobile-wrapper">
      {/* Header */}
      <div style={{
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px',
        borderBottom: '1px solid var(--gray-200)'
      }}>
        <button className="back-btn" onClick={() => navigate('/')} style={{ background: 'var(--gray-100)', color: 'var(--green-800)' }}>←</button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--green-900)' }}>
          {t('home.personalInfo')}
        </h2>
      </div>

      <div style={{ padding: '24px 20px' }}>
        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '90px', height: '90px', borderRadius: '50%', margin: '0 auto 10px',
              background: user?.avatar ? 'none' : 'linear-gradient(135deg, var(--green-600), var(--green-800))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: user?.avatar ? '14px' : '32px', color: 'white', cursor: 'pointer',
              overflow: 'hidden', border: '3px solid var(--green-200)',
              position: 'relative'
            }}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              getInitials(user?.name)
            )}
            {uploading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div className="spinner" style={{ width: '24px', height: '24px' }} />
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{t('profile.tapToChange')}</p>
        </div>

        {/* Phone (read-only) */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>{t('auth.phone')}</label>
          <input style={{ ...inputStyle, background: 'var(--gray-100)', color: 'var(--gray-400)' }}
            value={user?.phone || ''} disabled />
        </div>

        {/* Name */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>{t('auth.name')} *</label>
          <input style={inputStyle} name="name" value={form.name} onChange={handleChange} />
        </div>

        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>{t('auth.email')}</label>
          <input style={inputStyle} name="email" type="email" value={form.email} onChange={handleChange} />
        </div>

        {/* Age & Gender row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('auth.age')}</label>
            <input style={inputStyle} name="age" type="number" value={form.age} onChange={handleChange} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('auth.gender')}</label>
            <select style={inputStyle} name="gender" value={form.gender} onChange={handleChange}>
              <option value="">-</option>
              <option value="male">{t('auth.male')}</option>
              <option value="female">{t('auth.female')}</option>
              <option value="other">{t('auth.other')}</option>
            </select>
          </div>
        </div>

        {/* Date of Birth */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>{t('auth.dateOfBirth')}</label>
          <input style={inputStyle} name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
        </div>

        {/* Occupation */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>{t('auth.occupation')}</label>
          <input style={inputStyle} name="occupation" value={form.occupation} onChange={handleChange} />
        </div>

        {/* Language Toggle */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 0', borderTop: '1px solid var(--gray-100)', marginTop: '8px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('home.language')}</span>
          <button onClick={toggleLanguage} style={{
            padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--gray-200)',
            background: 'var(--gray-50)', cursor: 'pointer', fontSize: '13px', fontWeight: 500
          }}>
            {i18n.language === 'en' ? '🇹🇭 ภาษาไทย' : '🇬🇧 English'}
          </button>
        </div>

        {/* Credit display */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 0', borderTop: '1px solid var(--gray-100)'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('home.credit')}</span>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--green-700)' }}>
            ฿{(user?.credit || 0).toLocaleString()}
          </span>
        </div>

        {/* Save Button */}
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', marginTop: '20px' }}
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
