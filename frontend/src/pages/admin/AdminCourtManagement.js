import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { courtAPI } from '../../utils/api';

// dayOfWeek matches JS Date.getDay(): 0 = Sunday … 6 = Saturday
const DAYS = [
  { label: 'จันทร์', value: 1 },
  { label: 'อังคาร', value: 2 },
  { label: 'พุธ', value: 3 },
  { label: 'พฤหัสบดี', value: 4 },
  { label: 'ศุกร์', value: 5 },
  { label: 'เสาร์', value: 6 },
  { label: 'อาทิตย์', value: 0 },
];

const AdminCourtManagement = () => {
  const { t } = useTranslation();
  const [courts, setCourts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | 'create' | court object
  const [form, setForm]       = useState({
    courtNumber: '', name: '', description: '',
    pricePerHour: '', openTime: '06:00', closeTime: '22:00',
    pricing: [],
  });

  useEffect(() => { fetchCourts(); }, []);

  const fetchCourts = async () => {
    setLoading(true);
    try {
      const res = await courtAPI.getAll();
      setCourts(res.data.data);
    } catch (e) { toast.error('โหลดข้อมูลคอร์ทไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setForm({ courtNumber: '', name: '', description: '', pricePerHour: '', openTime: '06:00', closeTime: '22:00', pricing: [] });
    setModal('create');
  };

  const openEdit = (court) => {
    setForm({
      courtNumber:  court.courtNumber,
      name:         court.name,
      description:  court.description || '',
      pricePerHour: court.pricePerHour,
      openTime:     court.openTime,
      closeTime:    court.closeTime,
      pricing:      court.pricing || [],
    });
    setModal(court);
  };

  const addPricingRow = () => {
    setForm({ ...form, pricing: [...form.pricing, { dayOfWeek: 1, startTime: '17:00', endTime: '21:00', pricePerHour: '' }] });
  };

  const updatePricingRow = (index, field, value) => {
    const rows = [...form.pricing];
    rows[index] = { ...rows[index], [field]: field === 'dayOfWeek' ? parseInt(value) : value };
    setForm({ ...form, pricing: rows });
  };

  const removePricingRow = (index) => {
    setForm({ ...form, pricing: form.pricing.filter((_, i) => i !== index) });
  };

  const handleSave = async () => {
    if (!form.courtNumber || !form.name || !form.pricePerHour) return toast.error('กรุณากรอกข้อมูลที่จำเป็น');
    try {
      if (modal === 'create') {
        await courtAPI.create(form);
        toast.success('สร้างคอร์ทแล้ว');
      } else {
        await courtAPI.update(modal.id, form);
        toast.success('อัปเดตคอร์ทแล้ว');
      }
      setModal(null);
      fetchCourts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const handleToggle = async (court) => {
    try {
      if (court.isActive) {
        await courtAPI.delete(court.id);
      } else {
        await courtAPI.update(court.id, { isActive: true });
      }
      fetchCourts();
    } catch (e) { toast.error('อัปเดตไม่สำเร็จ'); }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '3px',
    border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = { fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0px' };

  return (
    <AdminLayout activePage="courts">
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800, letterSpacing: '0.2px', textTransform: 'uppercase', color: '#061823' }}>
            {t('admin.courtManagement')}
          </h2>
          <button
            className="btn btn-primary"
            onClick={openCreate}
            style={{ width: 'auto', padding: '10px 20px', fontSize: '13px' }}
          >
            + {t('admin.addCourt')}
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: '4px', boxShadow: '0 1px 4px rgba(6,24,35,0.08)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {loading ? (
            <div className="loading-spinner" style={{ padding: '40px' }}><div className="spinner" /></div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('admin.name')}</th>
                  <th>{t('admin.price')}/ชม.</th>
                  <th>เวลาทำการ</th>
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {courts.map((court) => (
                  <tr key={court.id}>
                    <td style={{ fontWeight: 700, color: '#061823' }}>{court.courtNumber}</td>
                    <td style={{ fontWeight: 500 }}>{court.name}</td>
                    <td>฿{court.pricePerHour?.toLocaleString()}</td>
                    <td>{court.openTime} – {court.closeTime}</td>
                    <td>
                      <span className={`status-badge ${court.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
                        {court.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(court)}
                          style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '3px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                          แก้ไข
                        </button>
                        <button onClick={() => handleToggle(court)}
                          style={{
                            padding: '4px 12px', fontSize: '12px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                            background: court.isActive ? '#fee2e2' : '#dcfce7',
                            color:      court.isActive ? '#ef4444' : '#16a34a',
                          }}>
                          {court.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, letterSpacing: '0.1px', textTransform: 'uppercase', marginBottom: '20px', color: '#061823' }}>
              {modal === 'create' ? t('admin.addCourt') : t('admin.editCourt')}
            </h3>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>หมายเลขคอร์ท *</label>
                <input style={inputStyle} type="number" value={form.courtNumber}
                  onChange={(e) => setForm({ ...form, courtNumber: e.target.value })} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>ชื่อ *</label>
                <input style={inputStyle} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>รายละเอียด</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>ราคา/ชม. (฿) *</label>
              <input style={inputStyle} type="number" value={form.pricePerHour}
                onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>เวลาเปิด</label>
                <input style={inputStyle} type="time" value={form.openTime}
                  onChange={(e) => setForm({ ...form, openTime: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>เวลาปิด</label>
                <input style={inputStyle} type="time" value={form.closeTime}
                  onChange={(e) => setForm({ ...form, closeTime: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={labelStyle}>ราคาตามช่วงเวลา (Peak)</label>
                <button onClick={addPricingRow} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '3px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#073659', fontWeight: 600 }}>
                  + เพิ่ม
                </button>
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>
                ชั่วโมงนอกช่วงเวลาเหล่านี้คิดราคาปกติ ฿{form.pricePerHour || '—'}/ชม.
              </div>
              {(form.pricing || []).map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                  <select style={{ ...inputStyle, flex: 2 }} value={row.dayOfWeek} onChange={(e) => updatePricingRow(i, 'dayOfWeek', e.target.value)}>
                    {DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                  </select>
                  <input type="time" style={{ ...inputStyle, flex: 1 }} value={row.startTime} onChange={(e) => updatePricingRow(i, 'startTime', e.target.value)} />
                  <input type="time" style={{ ...inputStyle, flex: 1 }} value={row.endTime} onChange={(e) => updatePricingRow(i, 'endTime', e.target.value)} />
                  <input type="number" placeholder="฿" style={{ ...inputStyle, flex: 1 }} value={row.pricePerHour} onChange={(e) => updatePricingRow(i, 'pricePerHour', e.target.value)} />
                  <button onClick={() => removePricingRow(i)} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#ef4444' }}>x</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '13px' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleSave} style={{ flex: 1, padding: '10px', border: 'none', background: '#073659', color: '#ffde17', borderRadius: '3px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.1px', textTransform: 'uppercase' }}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminCourtManagement;
