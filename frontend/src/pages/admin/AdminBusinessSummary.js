import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { adminAPI } from '../../utils/api';

const AdminBusinessSummary = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('month');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSummary(); }, [period]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getBusinessSummary(period);
      setData(res.data.data);
    } catch (error) {
      toast.error('Failed to load business summary');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // CSV export — client-side, no extra backend route needed
  // -------------------------------------------------------
  const downloadCSV = () => {
    if (!data) return;
    const lines = [];
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

    lines.push(`B-Space Business Summary — ${periodLabel}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    lines.push('OVERVIEW');
    lines.push(`Total Revenue,฿${(data.totalRevenue || 0).toLocaleString()}`);
    lines.push(`Total Bookings,${data.totalBookings || 0}`);
    lines.push(`New Users,${data.newUsers || 0}`);
    const avg = data.totalBookings > 0 ? Math.round(data.totalRevenue / data.totalBookings) : 0;
    lines.push(`Avg per Booking,฿${avg.toLocaleString()}`);
    lines.push('');

    lines.push('BOOKINGS BY STATUS');
    lines.push('Status,Count');
    if (data.bookingsByStatus) {
      Object.entries(data.bookingsByStatus).forEach(([status, count]) => {
        lines.push(`${status},${count}`);
      });
    }
    lines.push('');

    lines.push('COURT UTILIZATION');
    lines.push('Court,Bookings,Total Hours');
    (data.courtUtilization || []).forEach(c => {
      lines.push(`"Court ${c.courtNumber} - ${c.name}",${c.bookings},${c.totalHours}`);
    });
    lines.push('');

    lines.push('COACH REVENUE');
    lines.push('Coach,Sessions,Revenue (฿)');
    (data.coachRevenue || []).forEach(c => {
      lines.push(`"${c.name}",${c.sessions},${c.revenue}`);
    });
    lines.push('');

    lines.push('TOP CUSTOMERS');
    lines.push('Customer,Bookings,Total Spent (฿)');
    (data.topCustomers || []).forEach(c => {
      lines.push(`"${c.name}",${c.bookings},${c.totalSpent}`);
    });
    lines.push('');

    lines.push('DAILY REVENUE');
    lines.push('Date,Revenue (฿),Bookings');
    (data.dailyRevenue || []).forEach(d => {
      lines.push(`${d.date},${d.revenue},${d.bookings}`);
    });

    // BOM prefix makes Excel open UTF-8 CSV correctly (important for Thai baht symbol)
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `bspace-summary-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const cardStyle = {
    background: '#fff',
    borderRadius: '4px',
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(6,24,35,0.08)',
    border: '1px solid #e5e7eb',
    borderTop: '3px solid #ffde17',
  };

  const PERIOD_LABELS = { week: 'This Week', month: 'This Month', year: 'This Year' };

  return (
    <AdminLayout activePage="business">
      <div style={{ padding: '28px 32px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800, letterSpacing: '0.2px', textTransform: 'uppercase', color: '#061823' }}>
            {t('admin.businessSummary')}
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Period toggle */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  style={{
                    padding: '8px 16px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-display)',
                    letterSpacing: '0px', textTransform: 'uppercase',
                    background: period === key ? '#073659' : '#fff',
                    color:      period === key ? '#fff' : '#6b7280',
                    border:     period === key ? 'none' : '1px solid #e5e7eb',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* CSV download */}
            <button
              onClick={downloadCSV}
              disabled={!data || loading}
              style={{
                padding: '8px 16px', borderRadius: '3px', border: '1px solid #073659',
                background: '#fff', color: '#073659', cursor: !data || loading ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-display)',
                letterSpacing: '0px', textTransform: 'uppercase',
                opacity: !data || loading ? 0.5 : 1,
              }}
            >
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : data ? (
          <>
            {/* 4 Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div style={cardStyle}>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0px', marginBottom: '6px' }}>Total Revenue</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#061823', fontFamily: 'var(--font-display)' }}>฿{(data.totalRevenue || 0).toLocaleString()}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0px', marginBottom: '6px' }}>Total Bookings</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#061823', fontFamily: 'var(--font-display)' }}>{data.totalBookings || 0}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0px', marginBottom: '6px' }}>New Users</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#061823', fontFamily: 'var(--font-display)' }}>{data.newUsers || 0}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0px', marginBottom: '6px' }}>Avg per Booking</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#061823', fontFamily: 'var(--font-display)' }}>
                  ฿{data.totalBookings > 0 ? Math.round(data.totalRevenue / data.totalBookings).toLocaleString() : 0}
                </div>
              </div>
            </div>

            {/* Bookings by Status + Court Utilization */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ ...cardStyle, borderTop: '3px solid #e5e7eb' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.1px', textTransform: 'uppercase', color: '#061823', marginBottom: '16px' }}>
                  Bookings by Status
                </h3>
                {data.bookingsByStatus && Object.entries(data.bookingsByStatus).map(([status, count]) => (
                  <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                    <span style={{ fontSize: '13px', textTransform: 'capitalize', color: '#374151' }}>{status.replace('_', ' ')}</span>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#061823' }}>{count}</span>
                  </div>
                ))}
                {(!data.bookingsByStatus || Object.keys(data.bookingsByStatus).length === 0) && (
                  <p style={{ color: '#9ca3af', fontSize: '13px' }}>No data</p>
                )}
              </div>

              <div style={{ ...cardStyle, borderTop: '3px solid #e5e7eb' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.1px', textTransform: 'uppercase', color: '#061823', marginBottom: '16px' }}>
                  Court Utilization
                </h3>
                {(data.courtUtilization || []).map((court, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                    <span style={{ fontSize: '13px', color: '#374151' }}>Court {court.courtNumber} — {court.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#061823' }}>{court.totalHours} hrs</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{court.bookings} bookings</div>
                    </div>
                  </div>
                ))}
                {(!data.courtUtilization || data.courtUtilization.length === 0) && (
                  <p style={{ color: '#9ca3af', fontSize: '13px' }}>No data</p>
                )}
              </div>
            </div>

            {/* Coach Revenue + Top Customers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ ...cardStyle, borderTop: '3px solid #e5e7eb' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.1px', textTransform: 'uppercase', color: '#061823', marginBottom: '16px' }}>
                  Coach Revenue
                </h3>
                {(data.coachRevenue || []).map((coach, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{coach.name}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{coach.sessions} sessions</div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#073659' }}>฿{(coach.revenue || 0).toLocaleString()}</span>
                  </div>
                ))}
                {(!data.coachRevenue || data.coachRevenue.length === 0) && (
                  <p style={{ color: '#9ca3af', fontSize: '13px' }}>No data</p>
                )}
              </div>

              <div style={{ ...cardStyle, borderTop: '3px solid #e5e7eb' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.1px', textTransform: 'uppercase', color: '#061823', marginBottom: '16px' }}>
                  Top Customers
                </h3>
                {(data.topCustomers || []).map((customer, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                        {i === 0 ? '01' : i === 1 ? '02' : i === 2 ? '03' : `${String(i + 1).padStart(2,'0')}`}. {customer.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{customer.bookings} bookings</div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#073659' }}>฿{(customer.totalSpent || 0).toLocaleString()}</span>
                  </div>
                ))}
                {(!data.topCustomers || data.topCustomers.length === 0) && (
                  <p style={{ color: '#9ca3af', fontSize: '13px' }}>No data</p>
                )}
              </div>
            </div>

            {/* Daily Revenue Bar Chart */}
            {data.dailyRevenue && data.dailyRevenue.length > 0 && (
              <div style={{ ...cardStyle, borderTop: '3px solid #e5e7eb' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.1px', textTransform: 'uppercase', color: '#061823', marginBottom: '20px' }}>
                  Daily Revenue
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '160px', padding: '0 4px' }}>
                  {data.dailyRevenue.map((day, i) => {
                    const maxRev = Math.max(...data.dailyRevenue.map(d => d.revenue || 0), 1);
                    const height = ((day.revenue || 0) / maxRev) * 140;
                    const hasRevenue = day.revenue > 0;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 600, color: '#9ca3af', minHeight: '14px' }}>
                          {hasRevenue ? `฿${Math.round(day.revenue / 1000)}k` : ''}
                        </div>
                        <div
                          title={`${day.date}: ฿${day.revenue?.toLocaleString()}`}
                          style={{
                            width: '100%',
                            maxWidth: '36px',
                            height: `${Math.max(height, hasRevenue ? 4 : 2)}px`,
                            background: hasRevenue ? '#ffde17' : '#e5e7eb',
                            borderRadius: '2px 2px 0 0',
                            transition: 'height 0.3s',
                            cursor: hasRevenue ? 'default' : 'default',
                          }}
                        />
                        <div style={{ fontSize: '9px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
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
          <p style={{ color: '#9ca3af' }}>No data available</p>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBusinessSummary;
