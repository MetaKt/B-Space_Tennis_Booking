import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { courtAPI } from '../../utils/api';

const AdminCourtManagement = () => {
  const { t } = useTranslation();
  const [courts, setCourts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | 'create' | court object
  const [form, setForm]       = useState({
    courtNumber: '', name: '', description: '',
    pricePerHour: '', openTime: '06:00', closeTime: '22:00',
  });

  useEffect(() => { fetchCourts(); }, []);

  const fetchCourts = async () => {
    setLoading(true);
    try {
      const res = await courtAPI.getAll();
      setCourts(res.data.data);
    } catch (e) { toast.error('Failed to load courts'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setForm({ courtNumber: '', name: '', description: '', pricePerHour: '', openTime: '06:00', closeTime: '22:00' });
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
    });
    setModal(court);
  };

  const handleSave = async () => {
    if (!form.courtNumber || !form.name || !form.pricePerHour) return toast.error('Fill required fields');
    try {
      if (modal === 'create') {
        await courtAPI.create(form);
        toast.success('Court created');
      } else {
        await courtAPI.update(modal.id, form);
        toast.success('Court updated');
      }
      setModal(null);
      fetchCourts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save');
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
    } catch (e) { toast.error('Failed to update'); }
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
                  <th>{t('admin.price')}/hr</th>
                  <th>Hours</th>
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
                        {court.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(court)}
                          style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '3px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                          Edit
                        </button>
                        <button onClick={() => handleToggle(court)}
                          style={{
                            padding: '4px 12px', fontSize: '12px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                            background: court.isActive ? '#fee2e2' : '#dcfce7',
                            color:      court.isActive ? '#ef4444' : '#16a34a',
                          }}>
                          {court.isActive ? 'Deactivate' : 'Activate'}
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
                <label style={labelStyle}>Court # *</label>
                <input style={inputStyle} type="number" value={form.courtNumber}
                  onChange={(e) => setForm({ ...form, courtNumber: e.target.value })} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Price / hr (฿) *</label>
              <input style={inputStyle} type="number" value={form.pricePerHour}
                onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Open Time</label>
                <input style={inputStyle} type="time" value={form.openTime}
                  onChange={(e) => setForm({ ...form, openTime: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Close Time</label>
                <input style={inputStyle} type="time" value={form.closeTime}
                  onChange={(e) => setForm({ ...form, closeTime: e.target.value })} />
              </div>
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
