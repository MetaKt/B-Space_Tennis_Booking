import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AdminLayout } from './AdminDashboard';
import { adminAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const AdminUserManagement = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ credit: 0, isActive: true, role: 'user' });

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

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--gray-200)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  };

  const selectStyle = {
    padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gray-200)',
    fontSize: '13px', background: 'white', outline: 'none'
  };

  return (
    <AdminLayout activePage="users">
      <div style={{ padding: '28px 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--green-900)', marginBottom: '24px' }}>
          {t('admin.userManagement')}
        </h2>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: '10px', marginBottom: '20px',
          padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid var(--gray-100)'
        }}>
          <input
            style={{ ...selectStyle, width: '250px' }}
            placeholder={`🔍 Search name or phone...`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select style={selectStyle} value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="master_admin">Master Admin</option>
          </select>
        </div>

        {/* Table */}
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
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Credit</th>
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td>{u.phone}</td>
                    <td style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{u.email || '-'}</td>
                    <td>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                        background: u.role === 'master_admin' ? 'var(--gold-100)' : u.role === 'admin' ? 'var(--blue-50)' : 'var(--gray-100)',
                        color: u.role === 'master_admin' ? 'var(--gold-600)' : u.role === 'admin' ? 'var(--blue-600)' : 'var(--gray-600)'
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--green-700)' }}>฿{(u.credit || 0).toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${u.isActive ? 'status-upcoming' : 'status-cancelled'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => openEdit(u)}
                        style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--gray-200)', background: 'white', cursor: 'pointer' }}>
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px', borderTop: '1px solid var(--gray-100)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }}>←</button>
              <span style={{ padding: '6px 12px', fontSize: '13px' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }}>→</button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '16px' }}>Edit User: {editModal.name}</h3>
            <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '16px' }}>
              📱 {editModal.phone}
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Credit (฿)</label>
              <input style={inputStyle} type="number" value={editForm.credit}
                onChange={(e) => setEditForm({ ...editForm, credit: parseFloat(e.target.value) || 0 })} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Status</label>
              <select style={inputStyle} value={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'true' })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            {currentUser?.role === 'master_admin' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-500)' }}>Role</label>
                <select style={inputStyle} value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="master_admin">Master Admin</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={() => setEditModal(null)} style={{ flex: 1 }}>
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

export default AdminUserManagement;
