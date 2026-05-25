import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { AdminLayout } from './AdminDashboard';
import { adminAPI, courtAPI, coachAPI, BACKEND_URL } from '../../utils/api';

const AdminBookingManagement = () => {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [courts, setCourts] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: '', paymentStatus: '', date: '', court: '', search: ''
  });
  const [reassignModal, setReassignModal] = useState(null);
  const [reassignForm, setReassignForm] = useState({ coachOption: 'none', coachId: '', outsideCoachName: '' });
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    fetchCourts();
    fetchCoaches();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [page, filters]);

  const fetchCourts = async () => {
    try {
      const res = await courtAPI.getAll();
      setCourts(res.data.data);
    } catch (e) { console.error(e); }
  };

  const fetchCoaches = async () => {
    try {
      const res = await coachAPI.getAll();
      setCoaches(res.data.data);
    } catch (e) { console.error(e); }
  };

  const getDuration = (booking) => {
    const [sh, sm] = booking.startTime.split(':').map(Number);
    const [eh, em] = booking.endTime.split(':').map(Number);
    return (eh * 60 + em - sh * 60 - sm) / 60;
  };

  const getNewCoachPrice = (booking, form) => {
    if (form.coachOption === 'none') return 0;
    if (form.coachOption === 'in_house' && form.coachId) {
      const coach = coaches.find(c => c.id === form.coachId);
      if (coach) return coach.pricePerHour * getDuration(booking);
    }
    return null; // outside: calculated server-side
  };

  const openReassignModal = (booking) => {
    setReassignModal(booking);
    setReassignForm({
      coachOption: booking.coachOption || 'none',
      coachId: booking.coach?.id || '',
      outsideCoachName: booking.outsideCoachName || ''
    });
  };

  const handleReassignCoach = async () => {
    if (!reassignModal) return;
    if (reassignForm.coachOption === 'in_house' && !reassignForm.coachId) {
      return toast.error('Please select a coach');
    }
    if (reassignForm.coachOption === 'outside' && !reassignForm.outsideCoachName.trim()) {
      return toast.error('Please enter outside coach name');
    }
    setReassigning(true);
    try {
      await adminAPI.reassignCoach(reassignModal.id, {
        coachOption: reassignForm.coachOption,
        coachId: reassignForm.coachOption === 'in_house' ? reassignForm.coachId : null,
        outsideCoachName: reassignForm.coachOption === 'outside' ? reassignForm.outsideCoachName.trim() : null
      });
      toast.success('Coach reassigned successfully');
      setReassignModal(null);
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reassign coach');
    } finally {
      setReassigning(false);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await adminAPI.getBookings(params);
      setBookings(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (bookingId) => {
    try {
      await adminAPI.confirmPayment(bookingId);
      toast.success('Payment confirmed');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to confirm payment');
    }
  };

  const handleStatusUpdate = async (bookingId, status) => {
    try {
      await adminAPI.updateBookingStatus(bookingId, { status });
      toast.success('Status updated');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const handleProcessRefund = async (bookingId) => {
    if (!window.confirm('Process refund for this booking? The full amount (cash paid + credits used) will be returned as credits to the user.')) return;
    try {
      await adminAPI.processRefund(bookingId);
      toast.success('Refund processed — credits added to user account');
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to process refund');
    }
  };

  const selectStyle = {
    padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gray-200)',
    fontSize: '13px', background: 'white', outline: 'none'
  };

  return (
    <AdminLayout activePage="bookings">
      <div style={{ padding: '28px 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--green-900)', marginBottom: '24px' }}>
          {t('admin.bookingManagement')}
        </h2>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px',
          padding: '16px', background: 'white', borderRadius: '12px',
          border: '1px solid var(--gray-100)'
        }}>
          <input
            style={{ ...selectStyle, width: '200px' }}
            placeholder={`🔍 ${t('admin.search')}...`}
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
          <select style={selectStyle} value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
            <option value="">{t('admin.allStatus')}</option>
            <option value="upcoming">{t('common.upcoming')}</option>
            <option value="completed">{t('common.completed')}</option>
            <option value="cancelled">{t('common.cancelled')}</option>
            <option value="no_show">{t('common.no_show')}</option>
          </select>
          <select style={selectStyle} value={filters.paymentStatus} onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}>
            <option value="">{t('admin.allPayment')}</option>
            <option value="pending">{t('common.pending')}</option>
            <option value="submitted">{t('common.submitted')}</option>
            <option value="confirmed">{t('common.confirmed')}</option>
            <option value="pending_refund">Pending Refund</option>
            <option value="refunded">Refunded</option>
          </select>
          <select style={selectStyle} value={filters.court} onChange={(e) => handleFilterChange('court', e.target.value)}>
            <option value="">{t('admin.allCourts')}</option>
            {courts.map(c => (
              <option key={c.id} value={c.id}>Court {c.courtNumber}</option>
            ))}
          </select>
          <input
            type="date"
            style={selectStyle}
            value={filters.date}
            onChange={(e) => handleFilterChange('date', e.target.value)}
          />
        </div>

        {/* Table */}
        <div style={{
          background: 'white', borderRadius: '12px', padding: '0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--gray-100)',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div className="loading-spinner" style={{ padding: '40px' }}><div className="spinner" /></div>
          ) : bookings.length === 0 ? (
            <p style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-400)' }}>No bookings found</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t('admin.user')}</th>
                    <th>{t('admin.court')}</th>
                    <th>{t('booking.date')}</th>
                    <th>{t('booking.time')}</th>
                    <th>{t('admin.status')}</th>
                    <th>{t('admin.payment')}</th>
                    <th>{t('booking.total')}</th>
                    <th>{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>{b.bookingId}</td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{b.user?.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{b.user?.phone}</div>
                      </td>
                      <td>Court {b.court?.courtNumber}</td>
                      <td>{format(new Date(b.date.slice(0, 10) + 'T12:00:00'), 'dd MMM yyyy')}</td>
                      <td>{b.startTime} - {b.endTime}</td>
                      <td><span className={`status-badge status-${b.status}`}>{t(`common.${b.status}`)}</span></td>
                      <td>
                        <span className={`status-badge status-${b.paymentStatus}`}>
                          {t(`common.${b.paymentStatus}`)}
                        </span>
                        {b.paymentSlip && (
                          <a href={`${BACKEND_URL}${b.paymentSlip}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: '10px', display: 'block', marginTop: '2px', color: 'var(--blue-500)' }}>
                            View slip
                          </a>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>฿{b.totalPrice?.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {b.paymentStatus === 'submitted' && (
                            <button
                              onClick={() => handleConfirmPayment(b.id)}
                              style={{
                                padding: '4px 8px', fontSize: '11px', borderRadius: '4px',
                                border: 'none', background: 'var(--green-600)', color: 'white',
                                cursor: 'pointer', fontWeight: 500
                              }}
                            >
                              ✓ Confirm
                            </button>
                          )}
                          {b.status === 'cancelled' && b.paymentStatus === 'pending_refund' && (
                            <button
                              onClick={() => handleProcessRefund(b.id)}
                              style={{
                                padding: '4px 8px', fontSize: '11px', borderRadius: '4px',
                                border: 'none', background: 'var(--amber-500)', color: 'white',
                                cursor: 'pointer', fontWeight: 500
                              }}
                            >
                              ↩ Process Refund
                            </button>
                          )}
                          {b.status === 'upcoming' && (
                            <>
                              {b.paymentStatus !== 'submitted' && b.paymentStatus !== 'pending_refund' && b.additionalAmountDue === 0 && (
                                <button
                                  onClick={() => openReassignModal(b)}
                                  style={{
                                    padding: '4px 8px', fontSize: '11px', borderRadius: '4px',
                                    border: '1px solid var(--blue-400)', background: 'white',
                                    color: 'var(--blue-600)', cursor: 'pointer'
                                  }}
                                >
                                  🔄 Coach
                                </button>
                              )}
                              <button
                                onClick={() => handleStatusUpdate(b.id, 'completed')}
                                style={{
                                  padding: '4px 8px', fontSize: '11px', borderRadius: '4px',
                                  border: '1px solid var(--blue-300)', background: 'white',
                                  color: 'var(--blue-500)', cursor: 'pointer'
                                }}
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(b.id, 'cancelled')}
                                style={{
                                  padding: '4px 8px', fontSize: '11px', borderRadius: '4px',
                                  border: '1px solid var(--red-300)', background: 'white',
                                  color: 'var(--red-500)', cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(b.id, 'no_show')}
                                style={{
                                  padding: '4px 8px', fontSize: '11px', borderRadius: '4px',
                                  border: '1px solid var(--amber-300)', background: 'white',
                                  color: 'var(--amber-600)', cursor: 'pointer'
                                }}
                              >
                                No Show
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', gap: '8px',
              padding: '16px', borderTop: '1px solid var(--gray-100)'
            }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }}>←</button>
              <span style={{ padding: '6px 12px', fontSize: '13px' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }}>→</button>
            </div>
          )}
        </div>
      </div>

      {/* Reassign Coach Modal */}
      {reassignModal && (() => {
        const newPrice = getNewCoachPrice(reassignModal, reassignForm);
        const oldPrice = reassignModal.coachPrice || 0;
        const priceDiff = newPrice !== null ? newPrice - oldPrice : null;
        const selectedCoach = coaches.find(c => c.id === reassignForm.coachId);

        return (
          <div className="modal-overlay" onClick={() => setReassignModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '92%' }}>
              <div className="modal-header" style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '17px' }}>🔄 Reassign Coach</h3>
                <button onClick={() => setReassignModal(null)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--gray-500)', padding: 0 }}>✕</button>
              </div>

              {/* Current booking info */}
              <div style={{ background: 'var(--gray-50)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: 'var(--gray-600)' }}>
                <div><strong>{reassignModal.bookingId}</strong> — Court {reassignModal.court?.courtNumber}</div>
                <div>{format(new Date(reassignModal.date.slice(0, 10) + 'T12:00:00'), 'dd MMM yyyy')} · {reassignModal.startTime} – {reassignModal.endTime}</div>
                <div style={{ marginTop: '4px' }}>
                  Current coach: <strong>{reassignModal.coachOption === 'none' ? 'None' : reassignModal.coachOption === 'outside' ? (reassignModal.outsideCoachName || 'Outside Coach') : (reassignModal.coach?.nickname || reassignModal.coach?.name || '—')}</strong>
                  {' '}· Current price: <strong>฿{oldPrice.toLocaleString()}</strong>
                </div>
              </div>

              {/* Coach option */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Coach Option</label>
                <select
                  className="form-input"
                  value={reassignForm.coachOption}
                  onChange={e => setReassignForm(f => ({ ...f, coachOption: e.target.value, coachId: '', outsideCoachName: '' }))}
                  style={{ fontSize: '13px' }}
                >
                  <option value="none">No Coach</option>
                  <option value="in_house">In-House Coach</option>
                  <option value="outside">Outside Coach</option>
                </select>
              </div>

              {reassignForm.coachOption === 'in_house' && (
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Select Coach</label>
                  <select
                    className="form-input"
                    value={reassignForm.coachId}
                    onChange={e => setReassignForm(f => ({ ...f, coachId: e.target.value }))}
                    style={{ fontSize: '13px' }}
                  >
                    <option value="">— Select a coach —</option>
                    {coaches.filter(c => c.isActive !== false).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nickname || c.name} · ฿{c.pricePerHour?.toLocaleString()}/hr
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {reassignForm.coachOption === 'outside' && (
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Outside Coach Name</label>
                  <input
                    className="form-input"
                    placeholder="Enter coach name"
                    value={reassignForm.outsideCoachName}
                    onChange={e => setReassignForm(f => ({ ...f, outsideCoachName: e.target.value }))}
                    style={{ fontSize: '13px' }}
                  />
                </div>
              )}

              {/* Price difference preview */}
              {newPrice !== null && (
                <div style={{
                  borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px',
                  background: priceDiff === 0 ? 'var(--gray-50)' : priceDiff > 0 ? 'var(--amber-50)' : 'var(--green-50)',
                  border: `1px solid ${priceDiff === 0 ? 'var(--gray-200)' : priceDiff > 0 ? 'var(--amber-300)' : 'var(--green-300)'}`,
                  color: priceDiff === 0 ? 'var(--gray-600)' : priceDiff > 0 ? 'var(--amber-700)' : 'var(--green-700)'
                }}>
                  <div>New coach price: <strong>฿{newPrice.toLocaleString()}</strong></div>
                  {priceDiff !== 0 && reassignModal.paymentStatus === 'confirmed' && (
                    <div style={{ marginTop: '4px' }}>
                      {priceDiff > 0
                        ? `⬆ User will owe ฿${Math.abs(priceDiff).toLocaleString()} more (payment required)`
                        : `⬇ ฿${Math.abs(priceDiff).toLocaleString()} will be refunded to user's credit`}
                    </div>
                  )}
                  {priceDiff !== 0 && reassignModal.paymentStatus === 'pending' && (
                    <div style={{ marginTop: '4px' }}>Price updated — no payment confirmed yet</div>
                  )}
                </div>
              )}

              {reassignForm.coachOption === 'outside' && (
                <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '12px' }}>
                  Outside coach fee will be calculated by the system based on current settings.
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button className="btn btn-outline" onClick={() => setReassignModal(null)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleReassignCoach}
                  disabled={reassigning}
                  style={{ flex: 1, background: 'var(--green-700)', border: 'none', color: 'white' }}
                >
                  {reassigning ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AdminLayout>
  );
};

export default AdminBookingManagement;
