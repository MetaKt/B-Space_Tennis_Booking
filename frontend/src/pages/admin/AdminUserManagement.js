import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { adminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const AdminUserManagement = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm]   = useState({ credit: 0, isActive: true, role: 'user' });

  useEffect(() => { fetchUsers(); }, [search, roleFilter, page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await adminAPI.getUsers(params);
      setUsers(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (e) { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const openEdit = (user) => {
    setEditForm({ credit: user.credit || 0, isActive: user.isActive, role: user.role });
    setEditModal(user);
  };

  const handleSave = async () => {
    try {
      await adminAPI.updateUser(editModal.id, editForm);
      toast.success('User updated');
      setEditModal(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update');
    }
  };

  const roleColors = {
    master_admin: { bg: '#fff8e1', color: '#b45309' },
    admin:        { bg: '#eff6ff', color: '#1d4ed8' },
    user:         { bg: '#f3f4f6', color: '#374151' },
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '3px',
    border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };

  const selectStyle = {
    padding: '8px 12px', borderRadius: '3px', border: '1px solid #e5e7eb',
    fontSize: '13px', background: '#fff', outline: 'none',
  };

  return (
    <AdminLayout activePage="users">
      <div style={{ padding: '28px 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800, letterSpacing: '0.2px', textTransform: 'uppercase', color: '#061823', marginBottom: '24px' }}>
          {t('admin.userManagement')}
        </h2>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', padding: '14px 16px', background: '#fff', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
          <input
            style={{ ...selectStyle, width: '260px' }}
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select style={selectStyle} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="master_admin">Master Admin</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: '4px', boxShadow: '0 1px 4px rgba(6,24,35,0.08)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {loading ? (
            <div className="loading-spinner" style={{ padding: '40px' }}><div className="spinner" /></div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.name')}</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Credit</th>
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const rc = roleColors[u.role] || roleColors.user;
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: '#061823' }}>{u.name}</td>
                      <td>{u.phone}</td>
                      <td style={{ fontSize: '13px', color: '#9ca3af' }}>{u.email || '—'}</td>
                      <td>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '2px', background: rc.bg, color: rc.color, textTransform: 'uppercase', letterSpacing: '0px' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#073659' }}>฿{(u.credit || 0).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${u.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => openEdit(u)}
                          style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '3px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid #e5e7eb' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 14px', borderRadius: '3px', border: '1px solid #e5e7eb', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
                Prev
              </button>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '6px 14px', borderRadius: '3px', border: '1px solid #e5e7eb', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}>
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, letterSpacing: '0.1px', textTransform: 'uppercase', color: '#061823', marginBottom: '4px' }}>
              Edit User
            </h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>{editModal.name} — {editModal.phone}</p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0px' }}>Credit (฿)</label>
              <input style={inputStyle} type="number" value={editForm.credit}
                onChange={(e) => setEditForm({ ...editForm, credit: parseFloat(e.target.value) || 0 })} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0px' }}>Status</label>
              <select style={inputStyle} value={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'true' })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            {currentUser?.role === 'master_admin' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0px' }}>Role</label>
                <select style={inputStyle} value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="master_admin">Master Admin</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setEditModal(null)} style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '13px' }}>
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

export default AdminUserManagement;
