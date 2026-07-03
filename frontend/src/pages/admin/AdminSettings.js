import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { settingsAPI } from '../../utils/api';

const AdminSettings = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('court_operations');
  // settings: grouped as { category: { key: value } }
  const [settings, setSettings] = useState({});
  // meta: key -> { label, description } so we don't clobber labels on save
  const [meta, setMeta]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await settingsAPI.getAll();
      // Backend returns a FLAT ARRAY of settings — group it by category for editing.
      const arr = Array.isArray(res.data.data) ? res.data.data : [];
      const grouped = {};
      const metaMap = {};
      arr.forEach((s) => {
        if (!grouped[s.category]) grouped[s.category] = {};
        grouped[s.category][s.key] = s.value;
        metaMap[s.key] = { label: s.label, description: s.description };
      });
      setSettings(grouped);
      setMeta(metaMap);
    } catch (e) {
      toast.error('โหลดการตั้งค่าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [];
      Object.entries(settings).forEach(([category, items]) => {
        // Skip add_ons — feature removed
        if (category === 'add_ons') return;
        Object.entries(items).forEach(([key, value]) => {
          updates.push({
            key,
            value,
            category,
            label: meta[key]?.label || key,
            description: meta[key]?.description || '',
          });
        });
      });
      await settingsAPI.bulkUpdate(updates);
      toast.success(t('common.saved'));
      // Re-fetch so local state matches what the server stored
      fetchSettings();
    } catch (error) {
      toast.error('บันทึกการตั้งค่าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (category, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [category]: { ...prev[category], [key]: value },
    }));
  };

  // Only two tabs — Add-ons removed (client cancelled feature)
  const tabs = [
    { key: 'court_operations', label: 'การดำเนินงานคอร์ท' },
    { key: 'payment',          label: 'การชำระเงิน' },
  ];

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '3px',
    border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: '13px', fontWeight: 600, color: '#6b7280',
    display: 'block', marginBottom: '4px',
  };

  // Numeric input handler that tolerates empty/partial input without storing NaN
  const onNumberChange = (category, key) => (e) => {
    const raw = e.target.value;
    updateSetting(category, key, raw === '' ? '' : (parseInt(raw, 10) || 0));
  };

  return (
    <AdminLayout activePage="settings">
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800, letterSpacing: '0.2px', textTransform: 'uppercase', color: '#061823' }}>
            {t('admin.settings')}
          </h2>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{ padding: '10px 22px', border: 'none', background: '#073659', color: '#ffde17', borderRadius: '3px', cursor: saving || loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.1px', textTransform: 'uppercase', opacity: saving || loading ? 0.6 : 1 }}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>

        {/* Tab headers */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '0', borderBottom: '2px solid #e5e7eb' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 22px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.1px',
                textTransform: 'uppercase',
                background: 'transparent',
                color: activeTab === tab.key ? '#073659' : '#9ca3af',
                borderBottom: activeTab === tab.key ? '2px solid #073659' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner" style={{ marginTop: '40px' }}><div className="spinner" /></div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '0 0 4px 4px', padding: '28px', boxShadow: '0 1px 4px rgba(6,24,35,0.08)', border: '1px solid #e5e7eb', borderTop: 'none' }}>

            {/* Court Operations */}
            {activeTab === 'court_operations' && (
              <div style={{ maxWidth: '500px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, letterSpacing: '0.1px', textTransform: 'uppercase', color: '#061823', marginBottom: '20px' }}>
                  กฎการจอง
                </h3>

                {/* These four live in the `court_operations` category */}
                {[
                  { label: 'จำนวนวันที่จองล่วงหน้าได้ (จำนวนวันสูงสุดที่ผู้ใช้จองได้)', key: 'booking_advance_days', default: 14 },
                  { label: 'จำนวนชั่วโมงขั้นต่ำต่อการจอง', key: 'min_booking_hours', default: 1 },
                  { label: 'จำนวนชั่วโมงสูงสุดต่อการจอง', key: 'max_booking_hours', default: 4 },
                  { label: 'ระยะเวลายกเลิก (ชั่วโมงก่อนเริ่มการจอง)', key: 'cancellation_hours', default: 24 },
                ].map(({ label, key, default: def }) => (
                  <div key={key} style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>{label}</label>
                    <input
                      style={inputStyle}
                      type="number"
                      value={settings.court_operations?.[key] ?? def}
                      onChange={onNumberChange('court_operations', key)}
                    />
                  </div>
                ))}

                {/* Outside Coach Fee lives in the `booking_rules` category */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>ค่าธรรมเนียมโค้ชภายนอก (฿)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={settings.booking_rules?.outside_coach_fee ?? 100}
                    onChange={onNumberChange('booking_rules', 'outside_coach_fee')}
                  />
                </div>
              </div>
            )}

            {/* Payment */}
            {activeTab === 'payment' && (
              <div style={{ maxWidth: '500px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, letterSpacing: '0.1px', textTransform: 'uppercase', color: '#061823', marginBottom: '20px' }}>
                  ข้อมูลการชำระเงิน
                </h3>

                {[
                  { label: 'ชื่อธนาคาร', key: 'payment_bank_name' },
                  { label: 'เลขที่บัญชี', key: 'payment_account_number' },
                  { label: 'ชื่อบัญชี', key: 'payment_account_name' },
                ].map(({ label, key }) => (
                  <div key={key} style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>{label}</label>
                    <input
                      style={inputStyle}
                      value={settings.payment?.[key] || ''}
                      onChange={(e) => updateSetting('payment', key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
