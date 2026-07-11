import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { AdminLayout } from './AdminDashboard';
import { adminAPI, courtAPI, coachAPI, BACKEND_URL } from '../../utils/api';

const PERIOD_OPTIONS = [
  { value: '',       label: 'ทั้งหมด' },
  { value: 'today',  label: 'วันนี้' },
  { value: 'week',   label: 'สัปดาห์นี้' },
  { value: 'month',  label: 'เดือนนี้' },
  { value: 'year',   label: 'ปีนี้' },
];

const AdminBookingManagement = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const [bookings, setBookings]     = useState([]);
  const [courts, setCourts]         = useState([]);
  const [coaches, setCoaches]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Parse initial values from URL query params (e.g. from dashboard quick links)
  const urlParams = new URLSearchParams(location.search);

  const [filters, setFilters] = useState({
    status:        '',
    paymentStatus: urlParams.get('paymentStatus') || '',
    period:        urlParams.get('period') || '',
    court:         '',
    search:        '',
  });

  const [reassignModal, setReassignModal]   = useState(null);
  const [reassignForm, setReassignForm]     = useState({ coachOption: 'none', coachId: '', outsideCoachName: '' });
  const [reassigning, setReassigning]       = useState(false);
  const [slipPreview, setSlipPreview]       = useState(null); // booking with slip to preview

  useEffect(() => {
    fetchCourts();
    fetchCoaches();
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filters.status)        params.status = filters.status;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      if (filters.period)        params.period = filters.period;
      if (filters.court)         params.court = filters.court;
      if (filters.search)        params.search = filters.search;

      const res = await adminAPI.getBookings(params);
      setBookings(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotalCount(res.data.pagination?.total || 0);
    } catch (error) {
      toast.error('โหลดรายการจองไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchBookings();
    // 30-second polling — near-real-time without Socket.IO (upgrade planned for deployment)
    const interval = setInterval(fetchBookings, 30000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

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

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  // -------------------------------------------------------
  // CANCEL — fixed: pass string directly, not wrapped object
  // -------------------------------------------------------
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('ยกเลิกการจองนี้? ระบบจะคืนเครดิตให้อัตโนมัติหากมีสิทธิ์')) return;
    try {
      await adminAPI.updateBookingStatus(bookingId, 'cancelled');
      toast.success('ยกเลิกการจองแล้ว');
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'ยกเลิกการจองไม่สำเร็จ');
    }
  };

  const handleConfirmPayment = async (bookingId) => {
    try {
      await adminAPI.confirmPayment(bookingId);
      toast.success('ยืนยันการชำระเงินแล้ว');
      fetchBookings();
    } catch (error) {
      toast.error('ยืนยันการชำระเงินไม่สำเร็จ');
    }
  };

  const handleProcessRefund = async (bookingId) => {
    if (!window.confirm('ดำเนินการคืนเงินสำหรับการจองนี้? จำนวนเต็มจะถูกคืนเป็นเครดิตให้ผู้ใช้')) return;
    try {
      await adminAPI.processRefund(bookingId);
      toast.success('คืนเงินสำเร็จ — เพิ่มเครดิตให้บัญชีผู้ใช้แล้ว');
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'คืนเงินไม่สำเร็จ');
    }
  };

  // Coach reassign helpers
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
    return null;
  };

  const openReassignModal = (booking) => {
    setReassignModal(booking);
    setReassignForm({
      coachOption:      booking.coachOption || 'none',
      coachId:          booking.coach?.id || '',
      outsideCoachName: booking.outsideCoachName || '',
    });
  };

  const handleReassignCoach = async () => {
    if (!reassignModal) return;
    if (reassignForm.coachOption === 'in_house' && !reassignForm.coachId) return toast.error('กรุณาเลือกโค้ช');
    if (reassignForm.coachOption === 'outside' && !reassignForm.outsideCoachName.trim()) return toast.error('กรุณากรอกชื่อโค้ชภายนอก');
    setReassigning(true);
    try {
      await adminAPI.reassignCoach(reassignModal.id, {
        coachOption:      reassignForm.coachOption,
        coachId:          reassignForm.coachOption === 'in_house' ? reassignForm.coachId : null,
        outsideCoachName: reassignForm.coachOption === 'outside' ? reassignForm.outsideCoachName.trim() : null,
      });
      toast.success('เปลี่ยนโค้ชสำเร็จ');
      setReassignModal(null);
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'เปลี่ยนโค้ชไม่สำเร็จ');
    } finally {
      setReassigning(false);
    }
  };

  const selectStyle = {
    padding: '8px 12px',
    borderRadius: '3px',
    border: '1px solid #e5e7eb',
    fontSize: '13px',
    background: '#fff',
    outline: 'none',
    color: '#374151',
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '3px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <AdminLayout activePage="bookings">
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800,
              letterSpacing: '0.2px', textTransform: 'uppercase', color: '#061823', marginBottom: '4px',
            }}>
              {t('admin.bookingManagement')}
            </h2>
            {!loading && (
              <p style={{ fontSize: '13px', color: '#6b7280' }}>พบ {totalCount} รายการ</p>
            )}
          </div>
        </div>

        {/* Period toggle */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange('period', opt.value)}
              style={{
                padding: '8px 16px',
                borderRadius: '3px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                letterSpacing: '0px',
                textTransform: 'uppercase',
                background: filters.period === opt.value ? '#073659' : '#fff',
                color:      filters.period === opt.value ? '#fff' : '#6b7280',
                boxShadow:  filters.period === opt.value ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                border:     filters.period === opt.value ? 'none' : '1px solid #e5e7eb',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px',
          padding: '14px 16px', background: '#fff', borderRadius: '4px',
          border: '1px solid #e5e7eb',
        }}>
          <input
            style={{ ...selectStyle, width: '200px' }}
            placeholder="ค้นหารหัส ชื่อ เบอร์โทร..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
          <select style={selectStyle} value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
            <option value="">ทุกสถานะ</option>
            <option value="upcoming">{t('common.upcoming')}</option>
            <option value="completed">{t('common.completed')}</option>
            <option value="cancelled">{t('common.cancelled')}</option>
          </select>
          <select style={selectStyle} value={filters.paymentStatus} onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}>
            <option value="">ทุกการชำระเงิน</option>
            <option value="pending">{t('common.pending')}</option>
            <option value="submitted">{t('common.submitted')}</option>
            <option value="confirmed">{t('common.confirmed')}</option>
            <option value="pending_refund">{t('common.pending_refund')}</option>
            <option value="refunded">{t('common.refunded')}</option>
          </select>
          <select style={selectStyle} value={filters.court} onChange={(e) => handleFilterChange('court', e.target.value)}>
            <option value="">ทุกคอร์ท</option>
            {courts.map(c => (
              <option key={c.id} value={c.id}>คอร์ท {c.courtNumber}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div style={{
          background: '#fff', borderRadius: '4px',
          boxShadow: '0 1px 4px rgba(6,24,35,0.08)', border: '1px solid #e5e7eb', overflow: 'hidden',
        }}>
          {loading ? (
            <div className="loading-spinner" style={{ padding: '40px' }}><div className="spinner" /></div>
          ) : bookings.length === 0 ? (
            <p style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>ไม่พบรายการจอง</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>รหัสการจอง</th>
                    <th>{t('admin.user')}</th>
                    <th>{t('admin.court')}</th>
                    <th>{t('booking.coach')}</th>
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
                    <tr key={b.id} className={b.paymentStatus === 'submitted' ? 'row-needs-action' : ''}>
                      <td style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>{b.bookingId}</td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{b.user?.name}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{b.user?.phone}</div>
                      </td>
                      <td>คอร์ท {b.court?.courtNumber}</td>
                      <td style={{ fontSize: '13px' }}>
                        {b.coachOption !== 'none'
                          ? (b.coach?.nickname || b.coach?.name || b.outsideCoachName || '—')
                          : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{format(new Date(b.date.slice(0, 10) + 'T12:00:00'), 'dd MMM yyyy')}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{b.startTime} - {b.endTime}</td>
                      <td><span className={`status-badge status-${b.status}`}>{t(`common.${b.status}`)}</span></td>
                      <td>
                        <span className={`status-badge status-${b.paymentStatus}`}>
                          {t(`common.${b.paymentStatus}`)}
                        </span>
                        {b.paymentSlips?.length > 0 && (
                          <button
                            onClick={() => setSlipPreview(b)}
                            style={{ fontSize: '10px', display: 'block', marginTop: '3px', background: 'none', border: 'none', cursor: 'pointer', color: '#073659', padding: 0, textDecoration: 'underline' }}
                          >
                            ดูสลิป{b.paymentSlips.length > 1 ? ` (${b.paymentSlips.length})` : ''}
                          </button>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>฿{b.totalPrice?.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {b.paymentStatus === 'submitted' && (
                            <button
                              onClick={() => handleConfirmPayment(b.id)}
                              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '3px', border: 'none', background: '#073659', color: '#ffde17', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0px' }}
                            >
                              ยืนยัน
                            </button>
                          )}
                          {b.status === 'cancelled' && b.paymentStatus === 'pending_refund' && (
                            <button
                              onClick={() => handleProcessRefund(b.id)}
                              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '3px', border: 'none', background: '#b45309', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                            >
                              คืนเงิน
                            </button>
                          )}
                          {b.status === 'upcoming' && b.paymentStatus !== 'submitted' && b.paymentStatus !== 'pending_refund' && b.additionalAmountDue === 0 && (
                            <button
                              onClick={() => openReassignModal(b)}
                              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '3px', border: '1px solid #e5e7eb', background: '#fff', color: '#073659', cursor: 'pointer' }}
                            >
                              {t('booking.coach')}
                            </button>
                          )}
                          {b.status === 'upcoming' && (
                            <button
                              onClick={() => handleCancelBooking(b.id)}
                              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '3px', border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', cursor: 'pointer' }}
                            >
                              {t('common.cancel')}
                            </button>
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid #e5e7eb' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 14px', borderRadius: '3px', border: '1px solid #e5e7eb', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#374151', opacity: page === 1 ? 0.5 : 1 }}>
                ก่อนหน้า
              </button>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '6px 14px', borderRadius: '3px', border: '1px solid #e5e7eb', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: '#374151', opacity: page === totalPages ? 0.5 : 1 }}>
                ถัดไป
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Slip Preview Modal */}
      {slipPreview && (
        <div className="modal-overlay" onClick={() => setSlipPreview(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '92%' }}>
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', letterSpacing: '0.1px', textTransform: 'uppercase' }}>
                สลิปการชำระเงิน — {slipPreview.bookingId}
              </h3>
              <button onClick={() => setSlipPreview(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280', padding: 0 }}>
                x
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
              {slipPreview.user?.name} ({slipPreview.user?.phone}) — คอร์ท {slipPreview.court?.courtNumber} — {format(new Date(slipPreview.date.slice(0, 10) + 'T12:00:00'), 'dd MMM yyyy')} {slipPreview.startTime}–{slipPreview.endTime}
            </div>
            {slipPreview.paymentSlips?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
                {slipPreview.paymentSlips.map((slip, i) => (
                  <div key={slip.id} style={{ position: 'relative' }}>
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>
                      สลิปที่ {slipPreview.paymentSlips.length - i} — {format(new Date(slip.uploadedAt), 'dd MMM yyyy HH:mm')}
                    </p>
                    <img
                      src={`${BACKEND_URL}${slip.filePath}`}
                      alt={`Payment Slip ${i + 1}`}
                      style={{ width: '100%', borderRadius: '4px', objectFit: 'contain', maxHeight: '400px', display: 'block' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fb = e.target.nextElementSibling;
                        if (fb) fb.style.display = 'block';
                      }}
                    />
                    <div style={{ display: 'none', padding: '24px', textAlign: 'center', background: '#f9fafb', borderRadius: '4px', border: '1px dashed #e5e7eb' }}>
                      <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '10px' }}>ไม่สามารถแสดงรูปสลิปในหน้านี้ได้</p>
                      <a
                        href={`${BACKEND_URL}${slip.filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '13px', color: '#073659', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        เปิดสลิปในแท็บใหม่
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#9ca3af', padding: '20px', textAlign: 'center' }}>ยังไม่มีการอัปโหลดสลิป</p>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setSlipPreview(null)} style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '13px' }}>
                ปิด
              </button>
              {slipPreview.paymentStatus === 'submitted' && (
                <button
                  onClick={() => { handleConfirmPayment(slipPreview.id); setSlipPreview(null); }}
                  style={{ flex: 1, padding: '10px', border: 'none', background: '#073659', color: '#ffde17', borderRadius: '3px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.1px', textTransform: 'uppercase' }}
                >
                  {t('admin.confirmPayment')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reassign Coach Modal */}
      {reassignModal && (() => {
        const newPrice = getNewCoachPrice(reassignModal, reassignForm);
        const oldPrice = reassignModal.coachPrice || 0;
        const priceDiff = newPrice !== null ? newPrice - oldPrice : null;

        return (
          <div className="modal-overlay" onClick={() => setReassignModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '92%' }}>
              <div className="modal-header" style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', letterSpacing: '0.1px', textTransform: 'uppercase' }}>เปลี่ยนโค้ช</h3>
                <button onClick={() => setReassignModal(null)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280', padding: 0 }}>x</button>
              </div>

              <div style={{ background: '#f9fafb', borderRadius: '4px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#6b7280' }}>
                <div><strong>{reassignModal.bookingId}</strong> — คอร์ท {reassignModal.court?.courtNumber}</div>
                <div>{format(new Date(reassignModal.date.slice(0, 10) + 'T12:00:00'), 'dd MMM yyyy')} · {reassignModal.startTime} – {reassignModal.endTime}</div>
                <div style={{ marginTop: '4px' }}>
                  โค้ชปัจจุบัน: <strong>{reassignModal.coachOption === 'none' ? 'ไม่มีโค้ช' : reassignModal.coachOption === 'outside' ? (reassignModal.outsideCoachName || 'โค้ชภายนอก') : (reassignModal.coach?.nickname || reassignModal.coach?.name || '—')}</strong>
                  {' '}· ราคาปัจจุบัน: <strong>฿{oldPrice.toLocaleString()}</strong>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>ตัวเลือกโค้ช</label>
                <select className="form-input" value={reassignForm.coachOption}
                  onChange={e => setReassignForm(f => ({ ...f, coachOption: e.target.value, coachId: '', outsideCoachName: '' }))}
                  style={{ fontSize: '13px' }}>
                  <option value="none">ไม่มีโค้ช</option>
                  <option value="in_house">โค้ชในสังกัด</option>
                  <option value="outside">โค้ชภายนอก</option>
                </select>
              </div>

              {reassignForm.coachOption === 'in_house' && (
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>เลือกโค้ช</label>
                  <select className="form-input" value={reassignForm.coachId}
                    onChange={e => setReassignForm(f => ({ ...f, coachId: e.target.value }))}
                    style={{ fontSize: '13px' }}>
                    <option value="">— เลือกโค้ช —</option>
                    {coaches.filter(c => c.isActive !== false).map(c => (
                      <option key={c.id} value={c.id}>{c.nickname || c.name} · ฿{c.pricePerHour?.toLocaleString()}/ชม.</option>
                    ))}
                  </select>
                </div>
              )}

              {reassignForm.coachOption === 'outside' && (
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>ชื่อโค้ชภายนอก</label>
                  <input className="form-input" placeholder="กรอกชื่อโค้ช"
                    value={reassignForm.outsideCoachName}
                    onChange={e => setReassignForm(f => ({ ...f, outsideCoachName: e.target.value }))}
                    style={{ fontSize: '13px' }} />
                </div>
              )}

              {newPrice !== null && (
                <div style={{
                  borderRadius: '4px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px',
                  background: priceDiff === 0 ? '#f9fafb' : priceDiff > 0 ? '#fffbeb' : '#f0fdf4',
                  border: `1px solid ${priceDiff === 0 ? '#e5e7eb' : priceDiff > 0 ? '#fcd34d' : '#86efac'}`,
                  color: priceDiff === 0 ? '#6b7280' : priceDiff > 0 ? '#b45309' : '#15803d',
                }}>
                  <div>ราคาโค้ชใหม่: <strong>฿{newPrice.toLocaleString()}</strong></div>
                  {priceDiff !== 0 && reassignModal.paymentStatus === 'confirmed' && (
                    <div style={{ marginTop: '4px' }}>
                      {priceDiff > 0
                        ? `ผู้ใช้ต้องชำระเพิ่ม ฿${Math.abs(priceDiff).toLocaleString()}`
                        : `จะคืนเครดิต ฿${Math.abs(priceDiff).toLocaleString()} ให้ผู้ใช้`}
                    </div>
                  )}
                </div>
              )}

              {reassignForm.coachOption === 'outside' && (
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px' }}>
                  ค่าธรรมเนียมโค้ชภายนอกคำนวณจากการตั้งค่าปัจจุบัน
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setReassignModal(null)} style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '13px' }}>
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleReassignCoach}
                  disabled={reassigning}
                  style={{ flex: 1, padding: '10px', border: 'none', background: '#073659', color: '#ffde17', borderRadius: '3px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.1px', textTransform: 'uppercase', opacity: reassigning ? 0.6 : 1 }}
                >
                  {reassigning ? 'กำลังบันทึก...' : 'ยืนยัน'}
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
