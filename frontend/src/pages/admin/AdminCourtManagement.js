import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { courtAPI } from '../../utils/api';

const AdminCourtManagement = () => {
  const { t } = useTranslation();
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | court object for edit
  const [form, setForm] = useState({
    courtNumber: '', name: '', description: '', surface: 'hard',
    pricePerHour: '', openTime: '06:00', closeTime: '22:00'
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
    setForm({ courtNumber: '', name: '', description: '', surface: 'hard', pricePerHour: '', openTime: '06:00', closeTime: '22:00' });
    setModal('create');
  };

  const openEdit = (court) => {
    setForm({
      courtNumber: court.courtNumber, name: court.name, description: court.description || '',
      surface: court.surface, pricePerHour: court.pricePerHour, openTime: court.openTime, closeTime: court.closeTime
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
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--gray-200)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  };

  return (
    <AdminLayout activePage="courts">
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--green-900)' }}>
            {t('admin.courtManagement')}
          </h2>
          <button className="btn btn-primary" onClick={openCreate}>+ {t('admin.addCourt')}</button>
        </div>

        <div style={{
          background: 'white', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--gray-100)', overflow: 'hidden'
        }}>
          {loading ? (
            <div className="loading-spinner" style={{ padding: '40px' }}><div className="spinner" /></div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('admin.name')}</th>
                  <th>{t('admin.surface')}</th>
                  <th>{t('admin.price')}/hr</th>
                  <th>{t('admin.hours')}</th>
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {courts.map((court) => (
                  <tr key={court.id}>
                    <td style={{ fontWeight: 600 }}>{court.courtNumber}</td>
                    <td>{court.name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{court.surface}</td>
                    <td>฿{court.pricePerHour?.toLocaleString()}</td>
                    <td>{court.openTime} - {court.closeTime}</td>
                    <td>
                      <span className={`status-badge ${court.isActive ? 'status-upcoming' : 'status-cancelled'}`}>
                        {court.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(court)}
                          style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--gray-200)', background: 'white', cursor: 'pointer' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleToggle(court)}
                          style={{
                            padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            background: court.isActive ? 'var(--red-50)' : 'var(--green-50)',
                            color: court.isActive ? 'var(--red-500)' : 'var(--green-600)'
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

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {modal === 'create' ? t('admin.addCourt') : t('admin.editCourt')}
            </h3>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Court # *</label>
                <input style={inputStyle} type="number" value={form.courtNumber}
                  onChange={(e) => setForm({ ...form, courtNumber: e.target.value })} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Name *</label>
                <input style={inputStyle} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Description</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Surface</label>
                <select style={inputStyle} value={form.surface}
                  onChange={(e) => setForm({ ...form, surface: e.target.value })}>
                  <option value="hard">Hard</option>
                  <option value="clay">Clay</option>
                  <option value="grass">Grass</option>
                  <option value="synthetic">Synthetic</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Price/hr (฿) *</label>
                <input style={inputStyle} type="number" value={form.pricePerHour}
                  onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Open Time</label>
                <input style={inputStyle} type="time" value={form.openTime}
                  onChange={(e) => setForm({ ...form, openTime: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Close Time</label>
                <input style={inputStyle} type="time" value={form.closeTime}
                  onChange={(e) => setForm({ ...form, closeTime: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-outline" onClick={() => setModal(null)} style={{ flex: 1 }}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>
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
