import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { coachAPI } from '../../utils/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SPECIALIZATIONS = ['Beginner', 'Intermediate', 'Advanced', 'Kids', 'Competition', 'Fitness', 'Technique'];

const AdminCoachManagement = () => {
  const { t } = useTranslation();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => { fetchCoaches(); }, []);

  const fetchCoaches = async () => {
    setLoading(true);
    try {
      const res = await coachAPI.getAll();
      setCoaches(res.data.data);
    } catch (e) { toast.error('Failed to load coaches'); }
    finally { setLoading(false); }
  };

  const defaultForm = () => ({
    name: '', nickname: '', phone: '', email: '', bio: '',
    specialization: [], certifications: '',
    yearsOfExperience: '', pricePerHour: '', pricePerSession: '',
    maxDailyBookings: 5, notes: '',
    availability: [{ dayOfWeek: 1, startTime: '08:00', endTime: '18:00' }]
  });

  const openCreate = () => { setForm(defaultForm()); setModal('create'); };

  const openEdit = (coach) => {
    setForm({
      name: coach.name, nickname: coach.nickname || '', phone: coach.phone || '',
      email: coach.email || '', bio: coach.bio || '',
      specialization: coach.specialization || [],
      certifications: (coach.certifications || []).join(', '),
      yearsOfExperience: coach.yearsOfExperience || '',
      pricePerHour: coach.pricePerHour || '', pricePerSession: coach.pricePerSession || '',
      maxDailyBookings: coach.maxDailyBookings || 5, notes: coach.notes || '',
      availability: coach.availability?.length ? coach.availability : [{ dayOfWeek: 1, startTime: '08:00', endTime: '18:00' }]
    });
    setModal(coach);
  };

  const handleSave = async () => {
    if (!form.name || !form.pricePerHour) return toast.error('Name and price required');
    const payload = {
      ...form,
      certifications: form.certifications ? form.certifications.split(',').map(c => c.trim()).filter(Boolean) : []
    };
    try {
      if (modal === 'create') {
        await coachAPI.create(payload);
        toast.success('Coach created');
      } else {
        await coachAPI.update(modal.id, payload);
        toast.success('Coach updated');
      }
      setModal(null);
      fetchCoaches();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save');
    }
  };

  const handleToggle = async (coach) => {
    try {
      if (coach.isActive) {
        await coachAPI.delete(coach.id);
      } else {
        await coachAPI.update(coach.id, { isActive: true });
      }
      fetchCoaches();
    } catch (e) { toast.error('Failed to update'); }
  };

  const toggleSpec = (spec) => {
    const current = form.specialization || [];
    setForm({
      ...form,
      specialization: current.includes(spec) ? current.filter(s => s !== spec) : [...current, spec]
    });
  };

  const addAvailability = () => {
    setForm({ ...form, availability: [...form.availability, { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' }] });
  };

  const updateAvailability = (index, field, value) => {
    const avail = [...form.availability];
    avail[index] = { ...avail[index], [field]: field === 'dayOfWeek' ? parseInt(value) : value };
    setForm({ ...form, availability: avail });
  };

  const removeAvailability = (index) => {
    setForm({ ...form, availability: form.availability.filter((_, i) => i !== index) });
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--gray-200)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  };

  return (
    <AdminLayout activePage="coaches">
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--green-900)' }}>
            {t('admin.coachManagement')}
          </h2>
          <button className="btn btn-primary" onClick={openCreate}>+ {t('admin.addCoach')}</button>
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
                  <th>{t('admin.name')}</th>
                  <th>Nickname</th>
                  <th>Specializations</th>
                  <th>Price/hr</th>
                  <th>Rating</th>
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {coaches.map((coach) => (
                  <tr key={coach.id}>
                    <td style={{ fontWeight: 500 }}>{coach.name}</td>
                    <td>{coach.nickname || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(coach.specialization || []).map((s, i) => (
                          <span key={i} style={{
                            fontSize: '11px', padding: '2px 6px', borderRadius: '8px',
                            background: 'var(--green-50)', color: 'var(--green-700)'
                          }}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td>฿{coach.pricePerHour?.toLocaleString()}</td>
                    <td>⭐ {coach.rating || 0}</td>
                    <td>
                      <span className={`status-badge ${coach.isActive ? 'status-upcoming' : 'status-cancelled'}`}>
                        {coach.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(coach)}
                          style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--gray-200)', background: 'white', cursor: 'pointer' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleToggle(coach)}
                          style={{
                            padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            background: coach.isActive ? 'var(--red-50)' : 'var(--green-50)',
                            color: coach.isActive ? 'var(--red-500)' : 'var(--green-600)'
                          }}>
                          {coach.isActive ? 'Deactivate' : 'Activate'}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {modal === 'create' ? t('admin.addCoach') : t('admin.editCoach')}
            </h3>

            {/* Basic Info */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Name *</label>
                <input style={inputStyle} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Nickname</label>
                <input style={inputStyle} value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Phone</label>
                <input style={inputStyle} value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Email</label>
                <input style={inputStyle} type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Bio</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </div>

            {/* Specializations */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Specializations</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {SPECIALIZATIONS.map((spec) => (
                  <span key={spec} onClick={() => toggleSpec(spec)}
                    style={{
                      padding: '4px 12px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
                      background: form.specialization?.includes(spec) ? 'var(--green-700)' : 'var(--gray-100)',
                      color: form.specialization?.includes(spec) ? 'white' : 'var(--gray-600)',
                      fontWeight: 500
                    }}>
                    {spec}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Certifications (comma-separated)</label>
              <input style={inputStyle} value={form.certifications}
                onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
            </div>

            {/* Pricing */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Price/hour (฿) *</label>
                <input style={inputStyle} type="number" value={form.pricePerHour}
                  onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Experience (years)</label>
                <input style={inputStyle} type="number" value={form.yearsOfExperience}
                  onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })} />
              </div>
            </div>

            {/* Availability */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Availability</label>
                <button onClick={addAvailability} style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                  border: '1px solid var(--green-300)', color: 'var(--green-600)',
                  background: 'white', cursor: 'pointer'
                }}>+ Add</button>
              </div>
              {(form.availability || []).map((avail, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                  <select style={{ ...inputStyle, flex: 2 }} value={avail.dayOfWeek}
                    onChange={(e) => updateAvailability(i, 'dayOfWeek', e.target.value)}>
                    {DAYS.map((day, di) => <option key={di} value={di + 1}>{day}</option>)}
                  </select>
                  <input type="time" style={{ ...inputStyle, flex: 1 }} value={avail.startTime}
                    onChange={(e) => updateAvailability(i, 'startTime', e.target.value)} />
                  <input type="time" style={{ ...inputStyle, flex: 1 }} value={avail.endTime}
                    onChange={(e) => updateAvailability(i, 'endTime', e.target.value)} />
                  <button onClick={() => removeAvailability(i)}
                    style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--red-500)' }}>
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
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

export default AdminCoachManagement;
