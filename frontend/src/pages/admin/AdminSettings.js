import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { settingsAPI } from '../../utils/api';

const AdminSettings = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('court_operations');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await settingsAPI.getAll();
      setSettings(res.data.data);
    } catch (e) { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [];
      Object.entries(settings).forEach(([category, items]) => {
        Object.entries(items).forEach(([key, value]) => {
          updates.push({ key, value, category });
        });
      });
      await settingsAPI.bulkUpdate(updates);
      toast.success(t('common.saved'));
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (category, key, value) => {
    setSettings({
      ...settings,
      [category]: { ...settings[category], [key]: value }
    });
  };

  const updateAddOn = (key, field, value) => {
    const current = settings.add_ons?.[key] || {};
    updateSetting('add_ons', key, { ...current, [field]: field === 'price' ? parseFloat(value) || 0 : value });
  };

  const tabs = [
    { key: 'court_operations', label: '⚙️ Court Operations' },
    { key: 'add_ons', label: '🎾 Add-on Options' },
    { key: 'payment', label: '💳 Payment' }
  ];

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--gray-200)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  };

  const addOns = [
    { key: 'ball_rental', label: 'Ball Rental', icon: '🎾' },
    { key: 'racket_rental', label: 'Racket Rental', icon: '🏸' },
    { key: 'towel', label: 'Towel', icon: '🧺' },
    { key: 'water', label: 'Water', icon: '💧' },
    { key: 'ball_machine', label: 'Ball Machine', icon: '🤖' }
  ];

  return (
    <AdminLayout activePage="settings">
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--green-900)' }}>
            {t('admin.settings')}
          </h2>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('common.loading') : `💾 ${t('common.save')}`}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 500,
                background: activeTab === tab.key ? 'white' : 'var(--gray-100)',
                color: activeTab === tab.key ? 'var(--green-800)' : 'var(--gray-500)',
                borderBottom: activeTab === tab.key ? '2px solid var(--green-600)' : '2px solid transparent'
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : (
          <div style={{
            background: 'white', borderRadius: '12px', padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--gray-100)'
          }}>
            {/* Court Operations Tab */}
            {activeTab === 'court_operations' && (
              <div style={{ maxWidth: '500px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Booking Rules</h3>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>
                    Advance Booking Days (max days ahead users can book)
                  </label>
                  <input style={inputStyle} type="number"
                    value={settings.booking_rules?.advance_booking_days || 14}
                    onChange={(e) => updateSetting('booking_rules', 'advance_booking_days', parseInt(e.target.value))} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>
                    Minimum Booking Hours
                  </label>
                  <input style={inputStyle} type="number"
                    value={settings.booking_rules?.min_booking_hours || 1}
                    onChange={(e) => updateSetting('booking_rules', 'min_booking_hours', parseInt(e.target.value))} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>
                    Maximum Booking Hours
                  </label>
                  <input style={inputStyle} type="number"
                    value={settings.booking_rules?.max_booking_hours || 4}
                    onChange={(e) => updateSetting('booking_rules', 'max_booking_hours', parseInt(e.target.value))} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>
                    Cancellation Window (hours before booking)
                  </label>
                  <input style={inputStyle} type="number"
                    value={settings.booking_rules?.cancellation_window_hours || 24}
                    onChange={(e) => updateSetting('booking_rules', 'cancellation_window_hours', parseInt(e.target.value))} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>
                    Outside Coach Fee (฿)
                  </label>
                  <input style={inputStyle} type="number"
                    value={settings.booking_rules?.outside_coach_fee || 100}
                    onChange={(e) => updateSetting('booking_rules', 'outside_coach_fee', parseInt(e.target.value))} />
                </div>
              </div>
            )}

            {/* Add-ons Tab */}
            {activeTab === 'add_ons' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Add-on Options</h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {addOns.map((addon) => {
                    const data = settings.add_ons?.[addon.key] || { name: addon.label, price: 0, available: false };
                    return (
                      <div key={addon.key} style={{
                        padding: '16px', borderRadius: '10px', border: '1px solid var(--gray-200)',
                        background: data.available ? 'var(--green-50)' : 'var(--gray-50)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 600 }}>
                            {addon.icon} {addon.label}
                          </span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={data.available || false}
                              onChange={(e) => updateAddOn(addon.key, 'available', e.target.checked)} />
                            <span style={{ fontSize: '12px' }}>Enabled</span>
                          </label>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Price (฿)</label>
                          <input style={inputStyle} type="number" value={data.price || ''}
                            onChange={(e) => updateAddOn(addon.key, 'price', e.target.value)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div style={{ maxWidth: '500px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Payment Information</h3>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>
                    Bank Name
                  </label>
                  <input style={inputStyle}
                    value={settings.payment?.payment_bank_name || ''}
                    onChange={(e) => updateSetting('payment', 'payment_bank_name', e.target.value)} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>
                    Account Number
                  </label>
                  <input style={inputStyle}
                    value={settings.payment?.payment_account_number || ''}
                    onChange={(e) => updateSetting('payment', 'payment_account_number', e.target.value)} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>
                    Account Name
                  </label>
                  <input style={inputStyle}
                    value={settings.payment?.payment_account_name || ''}
                    onChange={(e) => updateSetting('payment', 'payment_account_name', e.target.value)} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-500)', display: 'block', marginBottom: '4px' }}>
                    Payment Instructions
                  </label>
                  <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3}
                    value={settings.payment?.payment_instructions || ''}
                    onChange={(e) => updateSetting('payment', 'payment_instructions', e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
