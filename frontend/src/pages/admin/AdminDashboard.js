import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../utils/api';
import { format } from 'date-fns';

const AdminLayout = ({ children, activePage }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { key: 'dashboard', label: t('admin.dashboard'), icon: '📊', path: '/admin' },
    { key: 'bookings', label: t('admin.bookings'), icon: '📋', path: '/admin/bookings' },
    { key: 'courts', label: t('admin.courts'), icon: '🎾', path: '/admin/courts' },
    { key: 'coaches', label: t('admin.coaches'), icon: '🏫', path: '/admin/coaches' },
    { key: 'users', label: t('admin.users'), icon: '👥', path: '/admin/users' },
    { key: 'settings', label: t('admin.settings'), icon: '⚙️', path: '/admin/settings' },
  ];

  if (user?.role === 'master_admin') {
    menuItems.push({ key: 'business', label: t('admin.businessSummary'), icon: '💰', path: '/admin/business-summary' });
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{
        width: '260px', background: 'var(--green-900)', color: 'white',
        padding: '24px 0', position: 'fixed', height: '100vh', overflowY: 'auto'
      }}>
        <div style={{ padding: '0 20px', marginBottom: '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--gold-400)' }}>
            🎾 Tennis Club
          </h1>
          <div style={{
            marginTop: '8px', fontSize: '11px', padding: '3px 10px', borderRadius: '10px',
            background: 'var(--green-700)', display: 'inline-block', fontWeight: 500
          }}>
            {user?.role === 'master_admin' ? 'Master Admin' : 'Admin'}
          </div>
        </div>

        <nav>
          {menuItems.map((item) => (
            <div
              key={item.key}
              onClick={() => navigate(item.path)}
              style={{
                padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                background: activePage === item.key ? 'var(--green-800)' : 'transparent',
                borderLeft: activePage === item.key ? '3px solid var(--gold-400)' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { if (activePage !== item.key) e.currentTarget.style.background = 'var(--green-800)'; }}
              onMouseLeave={(e) => { if (activePage !== item.key) e.currentTarget.style.background = 'transparent'; }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ position: 'absolute', bottom: '20px', padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '13px', color: 'var(--green-300)', marginBottom: '8px' }}>
            {user?.name}
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{
              width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--green-700)',
              background: 'transparent', color: 'var(--green-300)', cursor: 'pointer', fontSize: '13px'
            }}
          >
            🚪 {t('auth.logout')}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ marginLeft: '260px', flex: 1, background: 'var(--gray-50)', minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  );
};

export { AdminLayout };

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [todayBookings, setTodayBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getTodayBookings()
      ]);
      setStats(statsRes.data.data);
      setTodayBookings(bookingsRes.data.data);
    } catch (error) {
      console.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    { label: t('admin.todayBookings'), value: stats.todayBookings || 0, icon: '📅', color: 'var(--blue-500)' },
    { label: t('admin.totalBookings'), value: stats.totalBookings || 0, icon: '📋', color: 'var(--green-600)' },
    { label: t('admin.totalUsers'), value: stats.totalUsers || 0, icon: '👥', color: 'var(--gold-500)' },
    { label: t('admin.activeCourts'), value: stats.activeCourts || 0, icon: '🎾', color: 'var(--green-700)' },
    { label: t('admin.pendingPayments'), value: stats.pendingPayments || 0, icon: '⏳', color: 'var(--amber-500)' },
    { label: t('admin.todayRevenue'), value: `฿${(stats.todayRevenue || 0).toLocaleString()}`, icon: '💰', color: 'var(--green-800)' },
  ] : [];

  return (
    <AdminLayout activePage="dashboard">
      <div style={{ padding: '28px 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--green-900)', marginBottom: '24px' }}>
          {t('admin.dashboard')}
        </h2>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : (
          <>
            {/* Stats Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px', marginBottom: '32px'
            }}>
              {statCards.map((card, i) => (
                <div key={i} style={{
                  background: 'white', borderRadius: '12px', padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--gray-100)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '6px' }}>{card.label}</div>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: card.color }}>{card.value}</div>
                    </div>
                    <span style={{ fontSize: '28px' }}>{card.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Today's Bookings */}
            <div style={{
              background: 'white', borderRadius: '12px', padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--gray-100)'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--green-900)' }}>
                📅 {t('admin.todayBookings')}
              </h3>

              {todayBookings.length === 0 ? (
                <p style={{ color: 'var(--gray-400)', fontSize: '14px' }}>No bookings today</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
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
                        <tr key={b.id}>
                          <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{b.bookingId}</td>
                          <td>{b.user?.name}</td>
                          <td>Court {b.court?.courtNumber}</td>
                          <td>{b.startTime} - {b.endTime}</td>
                          <td>
                            <span className={`status-badge status-${b.status}`}>
                              {t(`common.${b.status}`)}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge status-${b.paymentStatus}`}>
                              {t(`common.${b.paymentStatus}`)}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>฿{b.totalPrice?.toLocaleString()}</td>
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
