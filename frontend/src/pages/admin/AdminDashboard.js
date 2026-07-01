import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../utils/api';
import { format } from 'date-fns';

// ============================================================
// SHARED ADMIN LAYOUT
// ============================================================

const AdminLayout = ({ children, activePage }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { key: 'dashboard', label: t('admin.dashboard'), path: '/admin' },
    { key: 'bookings',  label: t('admin.bookings'),  path: '/admin/bookings' },
    { key: 'courts',   label: t('admin.courts'),    path: '/admin/courts' },
    { key: 'coaches',  label: t('admin.coaches'),   path: '/admin/coaches' },
    { key: 'users',    label: t('admin.users'),     path: '/admin/users' },
    { key: 'settings', label: t('admin.settings'),  path: '/admin/settings' },
  ];

  if (user?.role === 'master_admin') {
    menuItems.push({ key: 'business', label: t('admin.businessSummary'), path: '/admin/business-summary' });
  }

  const sidebarBg    = '#061823';
  const sidebarHover = '#073659';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{
        width: '240px',
        background: sidebarBg,
        color: '#fff',
        padding: '0',
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Logo area */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <img
            src="/B-Space_Logo_removedbg.png"
            alt="B-Space"
            style={{ height: '36px', display: 'block', marginBottom: '10px' }}
          />
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.2px',
            textTransform: 'uppercase',
            color: '#ffde17',
            fontFamily: 'var(--font-display)',
          }}>
            {user?.role === 'master_admin' ? 'Master Admin' : 'Admin Panel'}
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {menuItems.map((item) => {
            const isActive = activePage === item.key;
            return (
              <div
                key={item.key}
                onClick={() => navigate(item.path)}
                style={{
                  padding: '11px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.1px',
                  textTransform: 'uppercase',
                  background: isActive ? sidebarHover : 'transparent',
                  borderLeft: isActive ? '3px solid #ffde17' : '3px solid transparent',
                  color: isActive ? '#ffde17' : 'rgba(255,255,255,0.75)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = sidebarHover; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; } }}
              >
                {item.label}
              </div>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontWeight: 500 }}>
            {user?.name}
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.1px',
              textTransform: 'uppercase',
              borderRadius: '3px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ffde17'; e.currentTarget.style.color = '#ffde17'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          >
            {t('auth.logout')}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ marginLeft: '240px', flex: 1, background: '#f4f6f9', minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  );
};

export { AdminLayout };

// ============================================================
// DASHBOARD PAGE
// ============================================================

const PERIOD_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' };

const AdminDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [todayBookings, setTodayBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingPeriod, setBookingPeriod] = useState('month');

  const fetchDashboard = useCallback(async () => {
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getTodayBookings(),
      ]);
      setStats(statsRes.data.data);
      setTodayBookings(bookingsRes.data.data);
    } catch (error) {
      console.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    // 30-second polling for near-real-time updates (Socket.IO upgrade planned for deployment)
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const periodCount = stats?.bookingsByPeriod?.[bookingPeriod] ?? 0;

  const statCards = stats ? [
    {
      label: t('admin.todayBookings'),
      value: stats.todayBookings || 0,
      color: '#073659',
      onClick: () => navigate('/admin/bookings?period=today'),
    },
    {
      label: 'Total Bookings',
      value: periodCount,
      color: '#073659',
      isPeriod: true,
      onClick: () => navigate(`/admin/bookings?period=${bookingPeriod}`),
    },
    {
      label: t('admin.totalUsers'),
      value: stats.totalUsers || 0,
      color: '#073659',
      onClick: () => navigate('/admin/users'),
    },
    {
      label: t('admin.pendingPayments'),
      value: stats.pendingPayments || 0,
      color: stats.pendingPayments > 0 ? '#b45309' : '#073659',
      onClick: () => navigate('/admin/bookings?paymentStatus=submitted'),
    },
    ...(user?.role === 'master_admin' ? [{
      label: t('admin.todayRevenue'),
      value: `฿${(stats.todayRevenue || 0).toLocaleString()}`,
      color: '#073659',
      onClick: null,
    }] : []),
  ] : [];

  return (
    <AdminLayout activePage="dashboard">
      <div style={{ padding: '28px 32px' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '0.2px',
          textTransform: 'uppercase',
          color: '#061823',
          marginBottom: '24px',
        }}>
          {t('admin.dashboard')}
        </h2>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : (
          <>
            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '14px',
              marginBottom: '28px',
            }}>
              {statCards.map((card, i) => (
                <div
                  key={i}
                  onClick={card.onClick || undefined}
                  style={{
                    background: '#fff',
                    borderRadius: '4px',
                    padding: '20px',
                    boxShadow: '0 1px 4px rgba(6,24,35,0.08)',
                    border: '1px solid #e5e7eb',
                    cursor: card.onClick ? 'pointer' : 'default',
                    transition: 'box-shadow 0.15s',
                    borderTop: `3px solid #ffde17`,
                  }}
                  onMouseEnter={(e) => { if (card.onClick) e.currentTarget.style.boxShadow = '0 4px 12px rgba(6,24,35,0.12)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(6,24,35,0.08)'; }}
                >
                  {/* Period toggle inside the Total Bookings card */}
                  {card.isPeriod && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={(e) => { e.stopPropagation(); setBookingPeriod(key); }}
                          style={{
                            padding: '2px 7px',
                            fontSize: '10px',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            letterSpacing: '0px',
                            textTransform: 'uppercase',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            background: bookingPeriod === key ? '#073659' : '#f3f4f6',
                            color: bookingPeriod === key ? '#fff' : '#6b7280',
                            transition: 'all 0.15s',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0px' }}>
                    {card.isPeriod ? PERIOD_LABELS[bookingPeriod] : card.label}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: card.color, fontFamily: 'var(--font-display)', letterSpacing: '0.1px' }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Pending payments quick-action — shown only when there are slips to review */}
            {(stats?.pendingPayments || 0) > 0 && (
              <div
                onClick={() => navigate('/admin/bookings?paymentStatus=submitted')}
                style={{
                  background: '#fff8e1',
                  border: '1px solid #ffde17',
                  borderLeft: '4px solid #ffde17',
                  borderRadius: '4px',
                  padding: '14px 18px',
                  marginBottom: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#073659',
                }}
              >
                <span>{stats.pendingPayments} payment slip{stats.pendingPayments > 1 ? 's' : ''} waiting for your confirmation</span>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', letterSpacing: '0.1px', textTransform: 'uppercase' }}>Review &rarr;</span>
              </div>
            )}

            {/* Today's Bookings Table */}
            <div style={{
              background: '#fff',
              borderRadius: '4px',
              boxShadow: '0 1px 4px rgba(6,24,35,0.08)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.1px', textTransform: 'uppercase', color: '#061823' }}>
                  {t('admin.todayBookings')}
                </h3>
                <button
                  onClick={() => navigate('/admin/bookings?period=today')}
                  style={{ fontSize: '12px', color: '#073659', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  View All
                </button>
              </div>

              {todayBookings.length === 0 ? (
                <p style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>No bookings today</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>{t('admin.user')}</th>
                        <th>{t('admin.court')}</th>
                        <th>{t('booking.time')}</th>
                        <th>{t('admin.status')}</th>
                        <th>{t('admin.payment')}</th>
                        <th>{t('booking.total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayBookings.map((b) => (
                        <tr key={b.id} className={b.paymentStatus === 'submitted' ? 'row-needs-action' : ''}>
                          <td style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>{b.bookingId}</td>
                          <td style={{ fontWeight: 500 }}>{b.user?.name}</td>
                          <td>Court {b.court?.courtNumber}</td>
                          <td>{b.startTime} - {b.endTime}</td>
                          <td><span className={`status-badge status-${b.status}`}>{t(`common.${b.status}`)}</span></td>
                          <td><span className={`status-badge status-${b.paymentStatus}`}>{t(`common.${b.paymentStatus}`)}</span></td>
                          <td style={{ fontWeight: 700 }}>฿{b.totalPrice?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
