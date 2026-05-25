import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { adminAPI } from '../../utils/api';

const AdminBusinessSummary = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSummary(); }, [period]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getBusinessSummary({ period });
      setData(res.data.data);
    } catch (error) {
      toast.error('Failed to load business summary');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: 'white', borderRadius: '12px', padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--gray-100)'
  };

  const metricStyle = (color) => ({
    fontSize: '28px', fontWeight: 700, color, marginBottom: '4px'
  });

  const labelStyle = { fontSize: '13px', color: 'var(--gray-500)' };

  return (
    <AdminLayout activePage="business">
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--green-900)' }}>
            💰 {t('admin.businessSummary')}
          </h2>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['week', 'month', 'year'].map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 500,
                  background: period === p ? 'var(--green-800)' : 'var(--gray-100)',
                  color: period === p ? 'white' : 'var(--gray-600)'
                }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : data ? (
          <>
            {/* Revenue Overview */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px', marginBottom: '24px'
            }}>
              <div style={cardStyle}>
                <div style={metricStyle('var(--green-700)')}>฿{(data.totalRevenue || 0).toLocaleString()}</div>
                <div style={labelStyle}>Total Revenue</div>
              </div>
              <div style={cardStyle}>
                <div style={metricStyle('var(--blue-600)')}>{data.totalBookings || 0}</div>
                <div style={labelStyle}>Total Bookings</div>
              </div>
              <div style={cardStyle}>
                <div style={metricStyle('var(--gold-500)')}>{data.newUsers || 0}</div>
                <div style={labelStyle}>New Users</div>
              </div>
              <div style={cardStyle}>
                <div style={metricStyle('var(--green-600)')}>
                  ฿{data.totalBookings > 0 ? Math.round(data.totalRevenue / data.totalBookings).toLocaleString() : 0}
                </div>
                <div style={labelStyle}>Avg per Booking</div>
              </div>
            </div>

            {/* Bookings by Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={cardStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>📊 Bookings by Status</h3>
                {data.bookingsByStatus && Object.entries(data.bookingsByStatus).map(([status, count]) => (
                  <div key={status} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--gray-50)'
                  }}>
                    <span style={{ fontSize: '14px', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>{count}</span>
                  </div>
                ))}
              </div>

              {/* Court Utilization */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>🎾 Court Utilization</h3>
                {data.courtUtilization && data.courtUtilization.map((court, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--gray-50)'
                  }}>
                    <span style={{ fontSize: '14px' }}>Court {court.courtNumber} - {court.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{court.totalHours || 0} hrs</div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{court.totalBookings} bookings</div>
                    </div>
                  </div>
                ))}
                {(!data.courtUtilization || data.courtUtilization.length === 0) && (
                  <p style={{ color: 'var(--gray-400)', fontSize: '13px' }}>No data available</p>
                )}
              </div>
            </div>

            {/* Coach Revenue & Top Customers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={cardStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>🏫 Coach Revenue</h3>
                {data.coachRevenue && data.coachRevenue.map((coach, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--gray-50)'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>{coach.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{coach.sessions} sessions</div>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--green-700)' }}>
                      ฿{(coach.revenue || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                {(!data.coachRevenue || data.coachRevenue.length === 0) && (
                  <p style={{ color: 'var(--gray-400)', fontSize: '13px' }}>No data available</p>
                )}
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>🏆 Top Customers</h3>
                {data.topCustomers && data.topCustomers.map((customer, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--gray-50)'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {customer.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{customer.bookings} bookings</div>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--green-700)' }}>
                      ฿{(customer.totalSpent || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                {(!data.topCustomers || data.topCustomers.length === 0) && (
                  <p style={{ color: 'var(--gray-400)', fontSize: '13px' }}>No data available</p>
                )}
              </div>
            </div>

            {/* Daily Revenue */}
            {data.dailyRevenue && data.dailyRevenue.length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>📈 Daily Revenue</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '160px', padding: '0 8px' }}>
                  {data.dailyRevenue.map((day, i) => {
                    const maxRev = Math.max(...data.dailyRevenue.map(d => d.revenue || 0), 1);
                    const height = ((day.revenue || 0) / maxRev) * 140;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--gray-500)' }}>
                          {day.revenue > 0 ? `฿${Math.round(day.revenue / 1000)}k` : ''}
                        </div>
                        <div style={{
                          width: '100%', maxWidth: '40px', height: `${Math.max(height, 2)}px`,
                          background: day.revenue > 0 ? 'var(--green-500)' : 'var(--gray-100)',
                          borderRadius: '4px 4px 0 0', transition: 'height 0.3s'
                        }} />
                        <div style={{ fontSize: '9px', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                          {day.date?.slice(5) || ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--gray-400)' }}>No data available</p>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBusinessSummary;
